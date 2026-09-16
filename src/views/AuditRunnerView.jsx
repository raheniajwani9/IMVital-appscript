import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Loader2, Save, Send, CheckCircle2,
  AlertTriangle, MapPin, Calendar, Cloud, CloudOff, Wifi, Camera, ScanLine, X,
  Gauge, Star, ListChecks, ShieldCheck, Check
} from 'lucide-react';

import QuestionCard from '../components/QuestionCard';
import ScannerModal from '../components/ScannerModal';
import { computeAuditScore, validateAudit } from '../utils/auditEngine';
import { supabase } from '../supabaseClient';

const AUTOSAVE_DELAY_MS = 1500;

const norm = (v) => String(v ?? '').trim().toLowerCase();

const parseBarcodeConfig = (cfg) => {
  if (!cfg) return {};
  if (typeof cfg === 'string') {
    try { return JSON.parse(cfg); } catch (e) { return {}; }
  }
  return cfg;
};

async function resolveLocationFields(supabase, assignment, template) {
  let resolvedCluster = assignment?.cluster || template?.cluster || '';
  let resolvedLocationId = assignment?.location_id || assignment?.pod_id || '';
  let resolvedCity = assignment?.city || template?.city || '';

  const locSelect = 'pod_id, "Store Name", "Cluster", "City", "Location ID"';

  if (resolvedLocationId) {
    let { data: locData } = await supabase
      .from('locations')
      .select(locSelect)
      .eq('pod_id', resolvedLocationId)
      .maybeSingle();

    if (!locData) {
      const r = await supabase
        .from('locations')
        .select(locSelect)
        .filter('"Location ID"', 'eq', resolvedLocationId)
        .maybeSingle();
      locData = r.data;
    }

    if (!locData) {
      const r = await supabase
        .from('locations')
        .select(locSelect)
        .ilike('"Store Name"', resolvedLocationId)
        .maybeSingle();
      locData = r.data;
    }

    if (locData) {
      if (!resolvedCluster) resolvedCluster = locData.Cluster || locData.cluster || '';
      if (!resolvedCity) resolvedCity = locData.City || locData.city || '';
    }
  }

  if (!resolvedCluster || !resolvedLocationId || !resolvedCity) {
    const { data: schedData } = await supabase
      .from('schedules')
      .select('location_id, city')
      .eq('schedule_id', assignment?.schedule_id)
      .maybeSingle();

    if (schedData) {
      if (!resolvedLocationId) resolvedLocationId = schedData.location_id || '';
      if (!resolvedCity) resolvedCity = schedData.city || '';

      if (!resolvedCluster && schedData.location_id) {
        let { data: locData2 } = await supabase
          .from('locations')
          .select('pod_id, "Cluster", "City"')
          .eq('pod_id', schedData.location_id)
          .maybeSingle();

        if (!locData2) {
          const r2 = await supabase
            .from('locations')
            .select('pod_id, "Cluster", "City"')
            .filter('"Location ID"', 'eq', schedData.location_id)
            .maybeSingle();
          locData2 = r2.data;
        }

        if (!locData2) {
          const r3 = await supabase
            .from('locations')
            .select('pod_id, "Cluster", "City"')
            .ilike('"Store Name"', schedData.location_id)
            .maybeSingle();
          locData2 = r3.data;
        }

        if (locData2) {
          resolvedCluster = locData2.Cluster || locData2.cluster || '';
          if (!resolvedCity) resolvedCity = locData2.City || locData2.city || '';
        }
      }
    }
  }

  return { cluster: resolvedCluster, city: resolvedCity, location_id: resolvedLocationId };
}

export default function AuditRunnerView({ assignment, template, currentUser, onExit, onRefreshData }) {
  const [step, setStep] = useState('PRE_CHECKS');
  const [checks, setChecks] = useState({ network: navigator.onLine, location: false, camera: false });
  const [checking, setChecking] = useState(true);

  const [answers, setAnswers] = useState({});
  const [auditId, setAuditId] = useState(assignment.open_audit_id || '');
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState('');
  const [sectionIndex, setSectionIndex] = useState(0);
  const [saveState, setSaveState] = useState('idle');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [problems, setProblems] = useState([]);
  const [showProblems, setShowProblems] = useState(false);

  const isSubmittingRef = useRef(false);

  const [scanOpen, setScanOpen] = useState(false);
  const [scannedQuestionId, setScannedQuestionId] = useState('');
  const [scanNotice, setScanNotice] = useState(null);

  const sections = useMemo(() => {
    const list = [...(template?.sections || [])];
    return list.sort((a, b) => (Number(a.section_order) || 0) - (Number(b.section_order) || 0));
  }, [template]);

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const auditIdRef = useRef(auditId);
  auditIdRef.current = auditId;
  const autosaveTimer = useRef(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const runChecks = async () => {
      let locAllowed = false;
      let camAllowed = false;

      try {
        await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
        locAllowed = true;
      } catch (e) {}

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(t => t.stop());
        camAllowed = true;
      } catch (e) {
        console.error("Camera access denied:", e);
      }

      if (!cancelled) {
        setChecks({ network: navigator.onLine, location: locAllowed, camera: camAllowed });
        setChecking(false);
      }
    };
    runChecks();

    const localDraft = localStorage.getItem(`draft_${assignment.schedule_id}`);
    if (localDraft) {
      try {
        setAnswers(JSON.parse(localDraft));
      } catch (e) {
        console.error("Failed parsing local draft:", e);
      }
    }

    const startAudit = async () => {
      if (!navigator.onLine) {
        if (!cancelled) {
          setAuditId('LOCAL-AUD-' + Date.now());
          setBooting(false);
        }
        return;
      }

      try {
        let auditIdToUse = assignment.open_audit_id || assignment.audit_id;

        if (!auditIdToUse) {
          const { data: existingAudit } = await supabase
            .from('audits')
            .select('audit_id')
            .eq('schedule_id', assignment.schedule_id)
            .eq('status', 'IN_PROGRESS')
            .maybeSingle();

          if (existingAudit?.audit_id) {
            auditIdToUse = existingAudit.audit_id;
          }
        }

        if (!auditIdToUse) {
          auditIdToUse = `AUD-${Date.now()}`;

          const { cluster: resolvedCluster, city: resolvedCity, location_id: resolvedLocationId } =
            await resolveLocationFields(supabase, assignment, template);

          // FIX: Stop the duplicate DB insert if component unmounted due to React Strict Mode
          if (cancelled) return;

          const newAuditPayload = {
            audit_id: auditIdToUse,
            schedule_id: assignment.schedule_id,
            template_id: template?.template_id || assignment.template_id,
            template_name: template?.template_name || assignment.template_name || '',
            cluster: resolvedCluster,
            city: resolvedCity,
            template_version: assignment.template_version || template?.template_version || 'v1.0',
            location_id: resolvedLocationId || 'All Locations',
            priority: assignment.priority || 'MEDIUM',
            due_date: assignment.due_date ? new Date(assignment.due_date).toISOString() : null,
            auditor_id: currentUser?.user_id || null,
            auditor_name: currentUser?.name || '',
            auditor_email: currentUser?.email || '',
            total_questions: template?.questions_count || 0,
            status: 'IN_PROGRESS',
            started_at: new Date().toISOString()
          };

          const { error: upsertError } = await supabase
            .from('audits')
            .upsert([newAuditPayload], { onConflict: 'audit_id' });

          if (upsertError) throw upsertError;

          await supabase
            .from('schedules')
            .update({ status: 'IN_PROGRESS' })
            .eq('schedule_id', assignment.schedule_id);
        }

        const { data: draftData } = await supabase
          .from('audit_drafts')
          .select('draft_json')
          .eq('audit_id', auditIdToUse)
          .maybeSingle();

        if (!cancelled) {
          setAuditId(auditIdToUse);
          if (!localDraft && draftData?.draft_json) {
            setAnswers(draftData.draft_json);
          }
          setBooting(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Audit Boot Error:", err);
          setBootError(err.message || 'Server error while starting the audit.');
          setBooting(false);
        }
      }
    };

    startAudit();
    return () => { cancelled = true; };
  }, [assignment, currentUser, template]);

  const pushDraft = useCallback(async () => {
    if (!auditIdRef.current || !dirtyRef.current || isSubmittingRef.current) return;

    localStorage.setItem(`draft_${assignment.schedule_id}`, JSON.stringify(answersRef.current));

    if (!navigator.onLine) {
      dirtyRef.current = false;
      setSaveState('saved');
      return;
    }

    setSaveState('saving');
    try {
      const { error } = await supabase.from('audit_drafts').upsert({
        audit_id: auditIdRef.current,
        schedule_id: assignment.schedule_id,
        auditor_email: currentUser?.email || '',
        draft_json: answersRef.current,
        updated_at: new Date().toISOString()
      }, { onConflict: 'audit_id' });

      if (error) throw error;

      dirtyRef.current = false;
      setSaveState('saved');
    } catch (err) {
      console.error('Auto-save error:', err);
      setSaveState('error');
    }
  }, [assignment.schedule_id, currentUser]);

  const handleAnswerChange = (questionId, updater) => {
    if (isSubmittingRef.current || submitting || submitted) return;

    setAnswers((prev) => {
      const prevAnswer = prev[questionId] || {};
      const nextAnswer = typeof updater === 'function' ? updater(prevAnswer) : updater;
      return { ...prev, [questionId]: nextAnswer };
    });

    dirtyRef.current = true;
    setSaveState('saving');
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(pushDraft, AUTOSAVE_DELAY_MS);
  };

  useEffect(() => {
    return () => {
      clearTimeout(autosaveTimer.current);
      pushDraft();
    };
  }, [pushDraft]);

  const score = useMemo(() => computeAuditScore(template, answers), [template, answers]);

  const handleSaveNow = () => {
    if (isSubmittingRef.current || submitting || submitted) return;
    clearTimeout(autosaveTimer.current);
    dirtyRef.current = true;
    pushDraft();
  };

  const handleBarcodeScan = useCallback((code) => {
    setScanOpen(false);
    const needle = norm(code);
    if (!needle) return;

    let matched = null;
    let matchedText = '';

    sections.forEach((sec, sIdx) => {
      if (matched) return;
      (sec.questions || []).forEach((q) => {
        if (matched) return;
        const bc = parseBarcodeConfig(q.barcode_config);
        const fields = [
          q.question_id, q.item_code, q.barcode, q.sku, q.upc,
          bc.expected_code, bc.code, bc.value,
          ...(Array.isArray(bc.codes) ? bc.codes : []),
          ...(Array.isArray(bc.expected_codes) ? bc.expected_codes : [])
        ];
        if (fields.some((f) => f !== undefined && f !== null && f !== '' && norm(f) === needle)) {
          matched = { questionId: q.question_id, sectionIndex: sIdx };
          matchedText = q.question_text || '';
        }
      });
    });

    if (!matched) {
      sections.forEach((sec, sIdx) => {
        if (matched) return;
        (sec.questions || []).forEach((q) => {
          if (matched) return;
          if (norm(q.question_text).includes(needle)) {
            matched = { questionId: q.question_id, sectionIndex: sIdx };
            matchedText = q.question_text || '';
          }
        });
      });
    }

    if (matched) {
      setSectionIndex(matched.sectionIndex);
      setScannedQuestionId(matched.questionId);
      setScanNotice({ tone: 'ok', text: `Matched item: ${matchedText || 'checklist item'}` });
      setTimeout(() => {
        document.getElementById(`q-${matched.questionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
      setTimeout(() => setScannedQuestionId(''), 5000);
    } else {
      setScanNotice({ tone: 'warn', text: `No checklist item matched code "${code}".` });
    }
  }, [sections]);

  const handleRequestSubmit = () => {
    if (isSubmittingRef.current || submitting || submitted) return;
    const found = validateAudit(template, answers);
    setProblems(found);
    if (found.length) {
      setShowProblems(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setStep('REVIEW');
      window.scrollTo({ top: 0 });
    }
  };

  const handleFinalSubmit = async () => {
    if (isSubmittingRef.current || submitting || submitted) return;

    isSubmittingRef.current = true;
    setSubmitting(true);
    setSubmitted(true);
    setSubmitError('');
    clearTimeout(autosaveTimer.current);

    let resolvedCluster = assignment.cluster || template?.cluster || '';
    let resolvedLocationId = assignment.location_id || assignment.pod_id || '';
    let resolvedCity = assignment.city || template?.city || '';

    const locSelect = 'pod_id, "Store Name", "Cluster", "City", "Location ID"';

    try {
      if (!resolvedCluster || !resolvedLocationId || !resolvedCity) {
        if (resolvedLocationId) {
          let { data: locData } = await supabase
            .from('locations')
            .select(locSelect)
            .eq('pod_id', resolvedLocationId)
            .maybeSingle();

          if (!locData) {
            const r = await supabase
              .from('locations')
              .select(locSelect)
              .filter('"Location ID"', 'eq', resolvedLocationId)
              .maybeSingle();
            locData = r.data;
          }

          if (!locData) {
            const r = await supabase
              .from('locations')
              .select(locSelect)
              .ilike('"Store Name"', resolvedLocationId)
              .maybeSingle();
            locData = r.data;
          }

          if (locData) {
            if (!resolvedCluster) resolvedCluster = locData.Cluster || locData.cluster || '';
            if (!resolvedCity) resolvedCity = locData.City || locData.city || '';
          }
        }

        const { data: schedData } = await supabase
          .from('schedules')
          .select('location_id, city')
          .eq('schedule_id', assignment.schedule_id)
          .maybeSingle();

        if (schedData) {
          if (!resolvedLocationId) resolvedLocationId = schedData.location_id || '';
          if (!resolvedCity) resolvedCity = schedData.city || '';

          if (!resolvedCluster && schedData.location_id) {
            let { data: locData2 } = await supabase
              .from('locations')
              .select('pod_id, "Cluster", "City"')
              .eq('pod_id', schedData.location_id)
              .maybeSingle();

            if (!locData2) {
              const r2 = await supabase
                .from('locations')
                .select('pod_id, "Cluster", "City"')
                .filter('"Location ID"', 'eq', schedData.location_id)
                .maybeSingle();
              locData2 = r2.data;
            }

            if (!locData2) {
              const r3 = await supabase
                .from('locations')
                .select('pod_id, "Cluster", "City"')
                .ilike('"Store Name"', schedData.location_id)
                .maybeSingle();
              locData2 = r3.data;
            }

            if (locData2) {
              resolvedCluster = locData2.Cluster || locData2.cluster || '';
              if (!resolvedCity) resolvedCity = locData2.City || locData2.city || '';
            }
          }
        }
      }
    } catch (locErr) {
      console.error('Location resolution error:', locErr);
    }

    const payload = {
      audit_id: auditId,
      schedule_id: assignment.schedule_id,
      template_id: template?.template_id || assignment.template_id,
      template_name: template?.template_name || assignment.template_name,
      cluster: resolvedCluster,
      city: resolvedCity,
      template_version: assignment.template_version || template?.template_version || 'v1.0',
      location_id: resolvedLocationId || 'All Locations',
      priority: assignment.priority || 'MEDIUM',
      due_date: assignment.due_date || '',
      auditor_id: currentUser?.user_id || '',
      auditor_name: currentUser?.name || '',
      auditor_email: currentUser?.email || '',
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      answers,
      summary: score
    };

    if (!navigator.onLine) {
      const queue = JSON.parse(localStorage.getItem('offline_sync_queue') || '[]');
      queue.push(payload);
      localStorage.setItem('offline_sync_queue', JSON.stringify(queue));
      localStorage.removeItem(`draft_${assignment.schedule_id}`);

      setTimeout(() => {
        onExit({ submitted: true, score: score.percent, offline: true });
      }, 600);
      return;
    }

    try {
      const { error: auditError } = await supabase
        .from('audits')
        .update({
          status: 'SUBMITTED',
          submitted_at: new Date().toISOString(),
          template_name: template?.template_name || assignment.template_name || '',
          cluster: resolvedCluster,
          city: resolvedCity,
          location_id: resolvedLocationId || 'All Locations',
          total_score: score.score || 0,
          max_score: score.max || 0,
          score_percent: score.percent || 0,
          rating: score.rating || '—',
          critical_failures: score.criticalFailures || 0,
          failure_count: score.failures || 0,
          answered_questions: score.answered || 0,
          total_questions: score.total || 0,
          result: (score.percent >= 75 && score.criticalFailures === 0) ? 'PASSED' : 'FAILED',
        })
        .eq('audit_id', auditId);

      if (auditError) throw auditError;

      await supabase.from('responses').delete().eq('audit_id', auditId);

      const responsesToInsert = [];
      sections.forEach(sec => {
        (sec.questions || []).forEach(q => {
          const ans = answers[q.question_id];
          if (!ans) return;

          let valStr = ans.value;
          if (Array.isArray(valStr)) valStr = valStr.join(', ');

          responsesToInsert.push({
            response_id: `RES-${auditId}-${q.question_id}`,
            audit_id: auditId,
            question_id: q.question_id,
            template_id: template?.template_id || assignment.template_id,
            section_id: sec.section_id || '',
            section_name: sec.section_name || 'General',
            question_text: q.question_text || '',
            response_type: q.response_type || 'TEXT',
            response_value: ans.na ? 'N/A' : (valStr || ''),
            score: 0,
            max_score: q.points || 0,
            is_failure: ans.na ? false : (q.failure_response && q.failure_response !== 'NONE'),
            critical_question: q.critical_question || false,
            risk_category: q.risk_category || 'General',
            comment: ans.comment || '',
            answered_by: currentUser?.user_id,
            answered_at: new Date().toISOString(),
            evidence_uris: ans.evidence || [],
            evidence_count: (ans.evidence || []).length
          });
        });
      });

      if (responsesToInsert.length > 0) {
        const { error: responsesError } = await supabase
          .from('responses')
          .insert(responsesToInsert);
        if (responsesError) throw responsesError;
      }

      await supabase.from('audit_drafts').delete().eq('audit_id', auditId);
      await supabase.from('schedules').update({ status: 'COMPLETED' }).eq('schedule_id', assignment.schedule_id);

      localStorage.removeItem(`draft_${assignment.schedule_id}`);
      
      // FIX: Await the parent refresh so the list is accurate before transitioning
      if (onRefreshData) {
        await onRefreshData();
      }
      
      onExit({ submitted: true, score: score.percent });

    } catch (err) {
      console.error("Final submit error:", err);
      isSubmittingRef.current = false;
      setSubmitting(false);
      setSubmitted(false);
      setSubmitError(err.message || 'Server error during submission.');
    }
  };

  if (booting) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400 space-y-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <div className="text-xs font-semibold">Preparing your checklist...</div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-rose-200 text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
        <div className="text-sm font-bold text-slate-800">Could not open this audit</div>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">{bootError}</p>
        <button onClick={() => onExit({})} className="bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer">
          Back to My Audits
        </button>
      </div>
    );
  }

  if (step === 'REVIEW') {
    const scoreTone = (v) =>
      v === 'Excellent' || v === 'Good' ? 'text-emerald-600' : v === 'Poor' ? 'text-rose-600' : 'text-amber-600';
    const ratingLevel = (v) => ({ Excellent: 5, Good: 4, Average: 3, Poor: 2, 'Very Poor': 1 }[v] || 0);

    return (
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm max-w-2xl mx-auto mt-2 sm:mt-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Review Submission</h2>
            <p className="text-xs text-slate-500 mt-1">Please review your final score and details before submitting.</p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[11px] font-bold text-indigo-600 whitespace-nowrap shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" /> Final Step
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/60">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1.5">
              <Gauge className="w-3 h-3" /> Final Score
            </div>
            <div className="text-2xl font-black text-blue-600 leading-none">{score.percent}%</div>
            <div className="mt-2 h-1 w-full bg-blue-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, score.percent))}%` }} />
            </div>
            <div className="text-[10px] text-slate-400 font-medium mt-1.5">Audit compliance</div>
          </div>

          <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              <Star className="w-3 h-3" /> Rating
            </div>
            <div className={`text-xl font-black leading-none ${scoreTone(score.rating)}`}>{score.rating}</div>
            <div className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={`h-1 flex-1 rounded-full ${n <= ratingLevel(score.rating) ? 'bg-emerald-400' : 'bg-slate-200'}`} />
              ))}
            </div>
            <div className="text-[10px] text-slate-400 font-medium mt-1.5">Performance band</div>
          </div>

          <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              <ListChecks className="w-3 h-3" /> Answered
            </div>
            <div className="text-2xl font-black text-slate-900 leading-none">
              {score.answered}<span className="text-sm font-bold text-slate-300">/{score.total}</span>
            </div>
            <div className="mt-2 h-1 w-full bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-slate-500 rounded-full transition-all" style={{ width: `${score.total ? Math.round((score.answered / score.total) * 100) : 0}%` }} />
            </div>
            <div className="text-[10px] text-slate-400 font-medium mt-1.5">Questions completed</div>
          </div>

          <div className={`p-4 rounded-2xl ${score.criticalFailures > 0 ? 'border border-rose-100 bg-rose-50/60' : 'border border-slate-100 bg-slate-50'}`}>
            <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-1.5 ${score.criticalFailures > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              <AlertTriangle className="w-3 h-3" /> Critical Fails
            </div>
            <div className={`text-2xl font-black leading-none ${score.criticalFailures > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
              {score.criticalFailures}
            </div>
            {score.criticalFailures > 0 ? (
              <>
                <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-[10px] font-bold text-rose-600">
                  <AlertTriangle className="w-2.5 h-2.5" /> Action needed
                </div>
                <div className="text-[10px] text-rose-400 font-medium mt-1">Review failed items</div>
              </>
            ) : (
              <>
                <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-600">
                  <Check className="w-2.5 h-2.5" /> All clear
                </div>
                <div className="text-[10px] text-slate-400 font-medium mt-1">No critical issues</div>
              </>
            )}
          </div>
        </div>

        {submitError && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200/80 rounded-2xl text-rose-600 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {submitError}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-slate-100">
          <button
            onClick={() => setStep('EXECUTION')}
            disabled={submitting || isSubmittingRef.current || submitted}
            className="flex-1 border border-slate-200 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Return to Audit
          </button>

          <button
            onClick={handleFinalSubmit}
            disabled={submitting || isSubmittingRef.current || submitted}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : submitted ? <Check className="w-5 h-5" /> : <Send className="w-5 h-5" />}
            {submitting ? 'Submitting...' : submitted ? 'Submitted' : 'Confirm & Submit'}
          </button>
        </div>
      </div>
    );
  }

  const section = sections[sectionIndex];
  const sectionQuestions = [...(section?.questions || [])].sort((a, b) => (Number(a.question_order) || 0) - (Number(b.question_order) || 0));
  const isLastSection = sectionIndex === sections.length - 1;
  const progressPercent = score.total ? Math.round((score.answered / score.total) * 100) : 0;

  return (
    <div className="space-y-6 font-sans text-slate-800">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="min-w-0">
          <button onClick={() => onExit({})} className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:text-blue-700 tracking-wider uppercase mb-1 cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" /> My Audits
          </button>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{template?.template_name || assignment.template_name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {assignment.location_id || 'All Locations'}</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" /> Due {assignment.due_date || 'N/A'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg ${saveState === 'error' ? 'bg-rose-50 text-rose-600' : saveState === 'saving' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {saveState === 'error' ? <><CloudOff className="w-3 h-3" /> Not saved</> : saveState === 'saving' ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving</> : <><Cloud className="w-3 h-3" /> Draft saved</>}
          </span>
          <button onClick={handleSaveNow} disabled={submitting || isSubmittingRef.current || submitted} className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            <Save className="w-4 h-4" /> Save Draft
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Progress', value: `${progressPercent}%`, sub: `${score.answered} / ${score.total} answered`, tone: 'blue' },
          { label: 'Score', value: `${score.percent}%`, sub: `${score.score} / ${score.max} pts`, tone: 'emerald' },
          { label: 'Failures', value: score.failures, sub: `${score.naCount} marked N/A`, tone: 'amber' },
          { label: 'Critical', value: score.criticalFailures, sub: 'critical failures', tone: 'rose' }
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{card.label}</div>
            <div className={`text-2xl font-black mt-1 ${card.tone === 'rose' ? 'text-rose-600' : card.tone === 'amber' ? 'text-amber-600' : card.tone === 'emerald' ? 'text-emerald-600' : 'text-slate-900'}`}>{card.value}</div>
            <div className="text-[10px] font-semibold text-slate-400 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {showProblems && problems.length > 0 && (
        <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-700"><AlertTriangle className="w-4 h-4" /> {problems.length} item{problems.length > 1 ? 's' : ''} still need attention</div>
            <button onClick={() => setShowProblems(false)} className="text-[10px] font-bold text-rose-500 hover:text-rose-700 uppercase cursor-pointer">Dismiss</button>
          </div>
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {problems.slice(0, 12).map((p, idx) => (
              <li key={idx} className="text-[11px] font-semibold text-rose-600"><span className="text-rose-400">{p.section_name}</span> — {p.question_text} <span className="font-bold">({p.reason})</span></li>
            ))}
          </ul>
        </div>
      )}

      {scanNotice && (
        <div className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 border ${scanNotice.tone === 'ok' ? 'bg-emerald-50 border-emerald-200/80 text-emerald-700' : 'bg-amber-50 border-amber-200/80 text-amber-700'}`}>
          <span className="text-xs font-bold flex items-center gap-2 min-w-0 truncate">
            <ScanLine className="w-4 h-4 shrink-0" /> {scanNotice.text}
          </span>
          <button onClick={() => setScanNotice(null)} className="p-1 rounded-lg hover:bg-black/5 transition-colors cursor-pointer shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {sections.map((sec, idx) => {
          const secQuestions = sec.questions || [];
          const answeredCount = secQuestions.filter((q) => {
            const a = answers[q.question_id];
            return a && (a.na || (a.value !== undefined && a.value !== null && String(a.value).trim() !== ''));
          }).length;
          const done = secQuestions.length > 0 && answeredCount === secQuestions.length;

          return (
            <button
              key={sec.section_id || idx}
              onClick={() => setSectionIndex(idx)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${sectionIndex === idx ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              {done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              <span>{sec.section_name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${sectionIndex === idx ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500'}`}>{answeredCount}/{secQuestions.length}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {sectionQuestions.length > 0 ? (
          sectionQuestions.map((question, idx) => (
            <div
              key={question.question_id}
              id={`q-${question.question_id}`}
              className={`rounded-2xl transition-all duration-300 ${scannedQuestionId === question.question_id ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
            >
              <QuestionCard
                question={question}
                index={idx + 1}
                answer={answers[question.question_id] || {}}
                onChange={handleAnswerChange}
                auditId={auditId}
                currentUser={currentUser}
                invalidReason={showProblems ? problems.find(p => p.question_id === question.question_id)?.reason : ''}
              />
            </div>
          ))
        ) : (
          <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-xs font-semibold text-slate-400">
            No questions found in this section.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 sm:gap-3 bg-white p-2 sm:p-3 rounded-2xl border border-slate-200/80 shadow-sm sticky bottom-2 sm:bottom-4">
        <button onClick={() => setSectionIndex((i) => Math.max(i - 1, 0))} disabled={sectionIndex === 0} className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer shrink-0">
          <ChevronLeft className="w-4 h-4" /> <span className="hidden sm:inline">Previous</span>
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="text-[11px] font-bold text-slate-500 text-center truncate">
            <span className="hidden sm:inline">Section </span>
            <span className="text-slate-900">{sections.length ? sectionIndex + 1 : 0}</span> / {sections.length}
          </div>
        </div>

        {isLastSection ? (
          <button
            onClick={handleRequestSubmit}
            disabled={submitting || isSubmittingRef.current || submitted}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 sm:px-5 py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Review <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={() => setSectionIndex((i) => Math.min(i + 1, sections.length - 1))} className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 sm:px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer shrink-0">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <ScannerModal
        open={scanOpen}
        title="Scan item barcode"
        onScan={handleBarcodeScan}
        onClose={() => setScanOpen(false)}
      />
    </div>
  );
}