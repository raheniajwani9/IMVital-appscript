import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Loader2, Save, Send,
  CheckCircle2, AlertTriangle, MapPin, Calendar, Cloud, CloudOff, Wifi, Camera, ScanLine, X
} from 'lucide-react';
import QuestionCard from '../components/QuestionCard';
import ScannerModal from '../components/ScannerModal';
import { computeAuditScore, validateAudit } from '../utils/auditEngine';

const AUTOSAVE_DELAY_MS = 1500;

const norm = (v) => String(v ?? '').trim().toLowerCase();

// barcode_config reaches us already parsed from the backend, but accept a raw
// JSON string too so matching never silently fails on malformed config.
const parseBarcodeConfig = (cfg) => {
  if (!cfg) return {};
  if (typeof cfg === 'string') {
    try { return JSON.parse(cfg); } catch (e) { return {}; }
  }
  return cfg;
};

export default function AuditRunnerView({ assignment, template, currentUser, onExit, onRefreshData }) {
  const [step, setStep] = useState('PRE_CHECKS'); // PRE_CHECKS | EXECUTION | REVIEW
  const [checks, setChecks] = useState({ network: navigator.onLine, location: false, camera: false });
  const [checking, setChecking] = useState(true);

  const [answers, setAnswers] = useState({});
  const [auditId, setAuditId] = useState(assignment.open_audit_id || '');
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState('');
  const [sectionIndex, setSectionIndex] = useState(0);
  const [saveState, setSaveState] = useState('idle');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [problems, setProblems] = useState([]);
  const [showProblems, setShowProblems] = useState(false);

  // --- Scanner state ---
  const [scanOpen, setScanOpen] = useState(false);
  const [scannedQuestionId, setScannedQuestionId] = useState('');
  const [scanNotice, setScanNotice] = useState(null); // { tone: 'ok' | 'warn', text }

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

  // Load Offline Draft & Run Hardware Checks
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
        // Attempt to request live camera permissions directly
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
      setAnswers(JSON.parse(localDraft));
    }

    const payload = {
      audit_id: assignment.open_audit_id || '',
      schedule_id: assignment.schedule_id,
      template_id: template?.template_id || assignment.template_id,
      template_name: template?.template_name || assignment.template_name,
      template_version: assignment.template_version || template?.template_version || 'v1.0',
      location_id: assignment.location_id || 'All Locations',
      priority: assignment.priority || 'MEDIUM',
      due_date: assignment.due_date || '',
      auditor_id: currentUser?.user_id || '',
      auditor_name: currentUser?.name || '',
      auditor_email: currentUser?.email || '',
      total_questions: template?.questions_count || 0
    };

    if (navigator.onLine && typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler((res) => {
          if (cancelled) return;
          if (res && res.success) {
            setAuditId(res.audit_id);
            if (!localDraft) setAnswers(res.draft || {}); // Prefer local offline draft if it exists
          } else {
            setBootError(res?.message || 'Could not start this audit.');
          }
          setBooting(false);
        })
        .withFailureHandler((err) => {
          if (cancelled) return;
          setBootError(err?.message || 'Server error while starting the audit.');
          setBooting(false);
        })
        .apiStartAudit(payload);
    } else {
      setAuditId('LOCAL-AUD-' + Date.now());
      setBooting(false);
    }

    return () => { cancelled = true; };
  }, [assignment, currentUser, template]);

  const pushDraft = useCallback(() => {
    if (!auditIdRef.current || !dirtyRef.current) return;

    // Save to LocalStorage for Offline caching
    localStorage.setItem(`draft_${assignment.schedule_id}`, JSON.stringify(answersRef.current));

    if (!navigator.onLine || typeof google === 'undefined' || !google.script) {
      dirtyRef.current = false;
      setSaveState('saved');
      return;
    }

    setSaveState('saving');
    google.script.run
      .withSuccessHandler(() => {
        dirtyRef.current = false;
        setSaveState('saved');
      })
      .withFailureHandler(() => setSaveState('error'))
      .apiSaveAuditProgress({
        audit_id: auditIdRef.current,
        schedule_id: assignment.schedule_id,
        auditor_email: currentUser?.email || '',
        answers: answersRef.current
      });
  }, [assignment.schedule_id, currentUser]);

  const handleAnswerChange = (questionId, updater) => {
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
          q.question_id,
          q.item_code,
          q.barcode,
          q.sku,
          q.upc,
          bc.expected_code,
          bc.code,
          bc.value,
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

  const openScanner = () => {
    setScanNotice(null);
    setScanOpen(true);
  };

  // Auto-dismiss scan notice
  useEffect(() => {
    if (!scanNotice) return;
    const timer = setTimeout(() => setScanNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [scanNotice]);

  // Requirement 28: Review Gatekeeper
  const handleRequestSubmit = () => {
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

  // Final API Submission
  const handleFinalSubmit = () => {
    setSubmitting(true);
    setSubmitError('');
    clearTimeout(autosaveTimer.current);

    const payload = {
      audit_id: auditId,
      schedule_id: assignment.schedule_id,
      template_id: template?.template_id || assignment.template_id,
      template_name: template?.template_name || assignment.template_name,
      template_version: assignment.template_version || template?.template_version || 'v1.0',
      location_id: assignment.location_id || 'All Locations',
      priority: assignment.priority || 'MEDIUM',
      due_date: assignment.due_date || '',
      auditor_id: currentUser?.user_id || '',
      auditor_name: currentUser?.name || '',
      auditor_email: currentUser?.email || '',
      started_at: new Date().toISOString(), // Keep sheet sync happy
      created_at: new Date().toISOString(),
      answers,
      summary: score
    };

    if (navigator.onLine && typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler((res) => {
          setSubmitting(false);
          if (res && res.success) {
            localStorage.removeItem(`draft_${assignment.schedule_id}`);
            if (onRefreshData) onRefreshData();
            onExit({ submitted: true, score: res.score_percent });
          } else {
            setSubmitError(res?.message || 'Submission failed.');
          }
        })
        .withFailureHandler((err) => {
          setSubmitting(false);
          setSubmitError(err?.message || 'Server error during submission.');
        })
        .apiSubmitAudit(payload);
    } else {
      // Offline Queue
      const queue = JSON.parse(localStorage.getItem('offline_sync_queue') || '[]');
      queue.push(payload);
      localStorage.setItem('offline_sync_queue', JSON.stringify(queue));
      localStorage.removeItem(`draft_${assignment.schedule_id}`);

      setTimeout(() => {
        setSubmitting(false);
        onExit({ submitted: true, score: score.percent, offline: true });
      }, 600);
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

  if (step === 'PRE_CHECKS') {
    return (
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm max-w-lg mx-auto mt-4 sm:mt-10">
        <h2 className="text-xl font-black mb-1">Pre-Audit Checks</h2>
        <p className="text-xs text-slate-500 mb-6">Device and environment verification.</p>

        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between p-3 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-700"><Wifi className="w-4 h-4 text-blue-600"/> Network</div>
            {checks.network ? <CheckCircle2 className="w-5 h-5 text-emerald-500"/> : <span className="text-xs font-bold text-slate-400">OFFLINE</span>}
          </div>
          <div className="flex items-center justify-between p-3 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-700"><MapPin className="w-4 h-4 text-blue-600"/> Location Services</div>
            {checks.location ? <CheckCircle2 className="w-5 h-5 text-emerald-500"/> : <AlertTriangle className="w-5 h-5 text-amber-500"/>}
          </div>
          <div className="flex items-center justify-between p-3 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-700"><Camera className="w-4 h-4 text-blue-600"/> Camera Access</div>
            {checks.camera ? <CheckCircle2 className="w-5 h-5 text-emerald-500"/> : <AlertTriangle className="w-5 h-5 text-amber-500"/>}
          </div>
        </div>

        <p className="text-[11px] text-slate-400 font-semibold mb-8">
          Camera is used for photo evidence and item barcode scanning during the audit.
        </p>

        <div className="flex gap-3">
          <button onClick={() => onExit({})} className="flex-1 border py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button
            onClick={() => setStep('EXECUTION')}
            disabled={checking}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-colors"
          >
            {checking ? 'Checking...' : 'Start Audit'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'REVIEW') {
    return (
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm max-w-2xl mx-auto mt-2 sm:mt-6 space-y-6">
        <div>
          <h2 className="text-2xl font-black">Review Submission</h2>
          <p className="text-xs text-slate-500 mt-1">Please review your final score and details before submitting.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Final Score</div>
            <div className="text-2xl font-black text-blue-600">{score.percent}%</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rating</div>
            <div className={`text-xl font-black ${score.rating === 'Excellent' || score.rating === 'Good' ? 'text-emerald-600' : 'text-rose-600'}`}>{score.rating}</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Answered</div>
            <div className="text-2xl font-black text-slate-900">{score.answered}/{score.total}</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Critical Fails</div>
            <div className="text-2xl font-black text-rose-600">{score.criticalFailures}</div>
          </div>
        </div>

        {submitError && (
          <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-2xl text-rose-600 text-xs font-semibold text-center">
            {submitError}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-slate-100">
          <button onClick={() => setStep('EXECUTION')} disabled={submitting} className="flex-1 border border-slate-200 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors">Return to Audit</button>
          <button onClick={handleFinalSubmit} disabled={submitting} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5"/>}
            {submitting ? 'Submitting...' : 'Confirm & Submit'}
          </button>
        </div>
      </div>
    );
  }

  const section = sections[sectionIndex];
  const sectionQuestions = [...(section.questions || [])].sort((a, b) => (Number(a.question_order) || 0) - (Number(b.question_order) || 0));
  const isLastSection = sectionIndex === sections.length - 1;
  const progressPercent = score.total ? Math.round((score.answered / score.total) * 100) : 0;

  return (
    <div className="space-y-6 font-sans text-slate-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="min-w-0">
          <button onClick={() => onExit({})} className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:text-blue-700 tracking-wider uppercase mb-1 cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" /> My Audits
          </button>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight truncate">{template?.template_name || assignment.template_name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {assignment.location_id || 'All Locations'}</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" /> Due {assignment.due_date || 'N/A'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg ${saveState === 'error' ? 'bg-rose-50 text-rose-600' : saveState === 'saving' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {saveState === 'error' ? <><CloudOff className="w-3 h-3" /> Not saved</> : saveState === 'saving' ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving</> : <><Cloud className="w-3 h-3" /> Draft saved</>}
          </span>
          <button onClick={handleSaveNow} className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer">
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

      <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
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

      {/* Section tabs */}
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
        {sectionQuestions.map((question, idx) => (
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
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 sm:gap-3 bg-white p-2 sm:p-3 rounded-2xl border border-slate-200/80 shadow-sm sticky bottom-2 sm:bottom-4">
        <button onClick={() => setSectionIndex((i) => Math.max(i - 1, 0))} disabled={sectionIndex === 0} className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer shrink-0">
          <ChevronLeft className="w-4 h-4" /> <span className="hidden sm:inline">Previous</span>
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="text-[11px] font-bold text-slate-500 text-center truncate">
            <span className="hidden sm:inline">Section </span>
            <span className="text-slate-900">{sectionIndex + 1}</span> / {sections.length}
          </div>
        </div>

        {isLastSection ? (
          <button onClick={handleRequestSubmit} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 sm:px-5 py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer shrink-0">
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