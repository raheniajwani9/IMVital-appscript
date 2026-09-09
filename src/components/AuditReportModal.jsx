import React, { useState, useEffect, useMemo } from 'react';
import {
  X, FileText, MapPin, Calendar, User, ClipboardCheck, AlertTriangle,
  ShieldAlert, ShieldCheck, CheckCircle2, HelpCircle, Loader2, Download,
  ChevronDown, ChevronRight, ListChecks, Wrench, MessageSquare, Paperclip,
  Eye, Flag, Star
} from 'lucide-react';

/* ---------------------------------------------------------------
   Small helpers — date/score formatting used across the report
----------------------------------------------------------------*/
const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? String(v) : d.toLocaleDateString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric'
  });
};

const fmtDateTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? String(v) : d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const num = (v) => Number(v) || 0;
const isTrue = (v) => v === true || String(v).toUpperCase() === 'TRUE';

function scoreTone(p) {
  if (p >= 90) return { text: 'text-emerald-600', bg: 'bg-emerald-500', ring: 'stroke-emerald-500' };
  if (p >= 75) return { text: 'text-blue-600', bg: 'bg-blue-500', ring: 'stroke-blue-500' };
  if (p >= 50) return { text: 'text-amber-600', bg: 'bg-amber-500', ring: 'stroke-amber-500' };
  return { text: 'text-rose-600', bg: 'bg-rose-500', ring: 'stroke-rose-500' };
}

/* Donut ring for the headline score */
function ScoreRing({ percent, size = 120 }) {
  const p = Math.max(0, Math.min(100, num(percent)));
  const tone = scoreTone(p);
  const r = 46;
  const c = 2 * Math.PI * r;
  const off = c - (p / 100) * c;
  return (
    <svg width={size} height={size} viewBox="0 0 110 110" className="-rotate-90">
      <circle cx="55" cy="55" r={r} strokeWidth="10" className="stroke-slate-200" fill="none" />
      <circle
        cx="55" cy="55" r={r} strokeWidth="10" fill="none"
        className={tone.ring} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off}
        style={{ transition: 'stroke-dashoffset .6s ease' }}
      />
    </svg>
  );
}

/* Drive thumbnails only render for viewers who can open the file, so fall
   back to a plain attachment tile instead of a broken image. */
function EvidenceThumb({ evidence }) {
  const [broken, setBroken] = useState(false);

  if (!evidence) {
    return (
      <div className="w-12 h-12 rounded-lg bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center shrink-0 text-[9px] font-black">
        NONE
      </div>
    );
  }

  if (!evidence.thumbnail_url || broken) {
    return (
      <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-500 border border-blue-100 flex items-center justify-center shrink-0">
        <Paperclip className="w-4 h-4" />
      </div>
    );
  }

  return (
    <img
      src={evidence.thumbnail_url}
      alt={evidence.file_name || 'Evidence'}
      onError={() => setBroken(true)}
      className="w-12 h-12 rounded-lg object-cover border border-slate-200 bg-slate-50 shrink-0"
    />
  );
}

/* ---------------------------------------------------------------
   THE MODAL
----------------------------------------------------------------*/
export default function AuditReportModal({ auditId, templateName, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [openSection, setOpenSection] = useState(null);
  const [tab, setTab] = useState('responses'); // responses | actions
  const [tracking, setTracking] = useState(false);
  const [trackMsg, setTrackMsg] = useState('');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    setLoading(true); setError(''); setData(null); setTrackMsg('');
    if (typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler((res) => {
          if (res && res.success) setData(res);
          else setError((res && res.message) || 'Could not load this report.');
          setLoading(false);
        })
        .withFailureHandler((err) => {
          console.error(err);
          setError('Server error while loading the report.');
          setLoading(false);
        })
        .getAuditReport(auditId);
    } else {
      // local dev fallback
      setTimeout(() => setError('google.script.run unavailable (local dev).'), 400);
      setLoading(false);
    }
  }, [auditId]);

  const stats = useMemo(() => {
    if (!data) return null;
    const a = data.audit || {};
    return {
      score: num(a.score_percent),
      answered: num(a.answered_questions),
      total: num(a.total_questions),
      na: num(a.na_count),
      failures: num(a.failure_count),
      critical: num(a.critical_failures),
      rating: a.rating || '—',
      result: String(a.result || '').toUpperCase(),
      review: String((data.review && data.review.status) || a.status || 'SUBMITTED').toUpperCase(),
      sections: (data.sections || []).length,
      actions: (data.actions || []).length,
      openActions: (data.actions || []).filter(x => String(x.status).toUpperCase() === 'OPEN').length
    };
  }, [data]);

  const grouped = useMemo(() => {
    if (!data) return [];
    const map = {};
    (data.responses || []).forEach(r => {
      const key = r.section_name || 'General';
      (map[key] = map[key] || []).push(r);
    });
    return Object.keys(map).map(k => ({ section: k, rows: map[k] }));
  }, [data]);

  const tone = stats ? scoreTone(stats.score) : null;
  const failedItems = (data && data.failed_items) || [];

  const reviewTone =
    stats?.review === 'APPROVED' ? 'text-emerald-600'
    : stats?.review === 'REJECTED' ? 'text-rose-600'
    : 'text-blue-600';

  /* -------- raise corrective actions for every failed item -------- */
  const handleTrackFindings = () => {
    if (typeof google === 'undefined' || !google.script) {
      setTrackMsg('google.script.run unavailable (local dev).');
      return;
    }
    setTracking(true);
    setTrackMsg('');
    google.script.run
      .withSuccessHandler((res) => {
        setTracking(false);
        if (res && res.success) {
          setTrackMsg(
            `${res.actions_created} action(s) created` +
            (res.skipped ? `, ${res.skipped} already tracked.` : '.')
          );
          // refresh so the Actions tab shows the new rows
          google.script.run
            .withSuccessHandler((fresh) => { if (fresh && fresh.success) setData(fresh); })
            .getAuditReport(auditId);
        } else {
          setTrackMsg((res && res.message) || 'Could not track findings.');
        }
      })
      .withFailureHandler(() => {
        setTracking(false);
        setTrackMsg('Server error while tracking findings.');
      })
      .apiTrackFindings({
        audit_id: auditId,
        response_ids: failedItems.map(r => r.response_id),
        owner_email: data?.audit?.auditor_email || '',
        created_by: data?.audit?.auditor_email || ''
      });
  };

  /* -------- print / pdf via browser -------- */
  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=900,height=700');
    const title = data?.audit?.template_name || templateName || 'Audit Report';
    w.document.write(`<html><head><title>${title}</title>
      <style>
        body{font-family:Inter,system-ui,sans-serif;padding:28px;color:#0f172a}
        h1{font-size:18px;margin:0 0 2px} .sub{color:#64748b;font-size:12px;margin-bottom:18px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th{text-align:left;background:#f8fafc;padding:6px 8px;border-bottom:1px solid #e2e8f0}
        td{padding:6px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}
        .fail{color:#e11d48;font-weight:700} .ok{color:#059669;font-weight:700}
      </style></head><body>
      <h1>${title}</h1>
      <div class="sub">Audit ID: ${auditId} · Location: ${data?.audit?.location_id || '—'} ·
        Submitted: ${fmtDateTime(data?.audit?.submitted_at)} · Auditor: ${data?.audit?.auditor_name || data?.audit?.auditor_email || '—'} ·
        Score: ${num(data?.audit?.score_percent)}% (${data?.audit?.rating || '—'}) · Review: ${stats?.review || '—'}</div>
      <table><thead><tr>
        <th>Section</th><th>Question</th><th>Response</th><th>Score</th><th>Result</th><th>Evidence</th>
      </tr></thead><tbody>`);
    (data?.responses || []).forEach(r => {
      const urls = (r.evidence || []).map(e => e.file_url).filter(Boolean).join(', ');
      w.document.write(`<tr>
        <td>${r.section_name || ''}</td>
        <td>${r.question_text || ''}</td>
        <td>${isTrue(r.is_na) ? 'N/A' : (r.response_value || '—')}</td>
        <td>${r.score || 0}/${r.max_score || 0}</td>
        <td class="${isTrue(r.is_failure) ? 'fail' : 'ok'}">${isTrue(r.is_failure) ? 'FAIL' : 'PASS'}</td>
        <td>${urls}</td>
      </tr>`);
    });
    w.document.write(`</tbody></table></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* ---------- Header ---------- */}
        <div className="flex items-start justify-between gap-4 px-5 sm:px-7 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50/60 to-white shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-600/25">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-blue-600 tracking-widest uppercase">Audit Report</div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-tight truncate">
                {data?.audit?.template_name || templateName || 'Audit'}
              </h2>
              <div className="text-[11px] text-slate-500 font-mono">{auditId}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              disabled={!data}
              className="hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ---------- Body ---------- */}
        <div className="overflow-y-auto flex-1">
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <div className="text-xs font-semibold">Loading report…</div>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
              <AlertTriangle className="w-10 h-10 text-amber-400" />
              <div className="text-sm font-bold text-slate-800">Could not open this report</div>
              <p className="text-xs text-slate-500 max-w-sm">{error}</p>
              <button onClick={onClose} className="mt-2 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer">
                Close
              </button>
            </div>
          )}

          {!loading && data && stats && (
            <div className="px-5 sm:px-7 py-5 space-y-5">
              {/* ===== Meta strip ===== */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {[
                  { icon: MapPin, label: 'Location', value: data.audit.location_id || 'All Locations' },
                  { icon: Calendar, label: 'Submitted', value: fmtDate(data.audit.submitted_at) },
                  { icon: User, label: 'Auditor', value: data.audit.auditor_name || data.audit.auditor_email || '—' },
                  { icon: ListChecks, label: 'Sections', value: stats.sections }
                ].map((m, i) => (
                  <div key={i} className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2.5 min-w-0">
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      <m.icon className="w-3 h-3" /> {m.label}
                    </div>
                    <div className="font-bold text-slate-800 text-[11px] truncate mt-0.5" title={m.value}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* ===== Score summary card ===== */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="grid sm:grid-cols-[auto_1fr] gap-5 p-5">
                  {/* Donut */}
                  <div className="flex items-center justify-center">
                    <div className="relative">
                      <ScoreRing percent={stats.score} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-2xl font-black ${tone.text}`}>{stats.score}%</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Score</span>
                      </div>
                    </div>
                  </div>

                  {/* Result + stat pills */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide border
                        ${stats.result === 'FAILED' || stats.critical > 0
                          ? 'bg-rose-50 text-rose-600 border-rose-200'
                          : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                        {stats.result === 'FAILED' || stats.critical > 0
                          ? <><ShieldAlert className="w-3.5 h-3.5" /> Audit Failed</>
                          : <><ShieldCheck className="w-3.5 h-3.5" /> Audit Passed</>}
                      </span>
                      <span className="text-[11px] text-slate-400 font-semibold">
                        {num(data.audit.total_score)} / {num(data.audit.max_score)} pts
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { label: 'Rating', value: stats.rating, icon: Star, cls: 'text-slate-700' },
                        { label: 'Answered', value: `${stats.answered}/${stats.total}`, icon: CheckCircle2, cls: 'text-slate-700' },
                        { label: 'N/A', value: stats.na, icon: HelpCircle, cls: 'text-slate-500' },
                        { label: 'Failures', value: stats.failures, icon: AlertTriangle, cls: stats.failures ? 'text-amber-600' : 'text-slate-400' },
                        { label: 'Critical', value: stats.critical, icon: ShieldAlert, cls: stats.critical ? 'text-rose-600' : 'text-slate-400' },
                        { label: 'Review status', value: stats.review, icon: ClipboardCheck, cls: reviewTone }
                      ].map((s, i) => (
                        <div key={i} className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-3 py-2">
                          <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            <s.icon className="w-3 h-3" /> {s.label}
                          </div>
                          <div className={`font-black text-sm mt-0.5 truncate ${s.cls}`}>{s.value}</div>
                        </div>
                      ))}
                    </div>

                    {data.review?.review_comment && (
                      <div className="flex items-start gap-1.5 text-[10px] text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-200">
                        <MessageSquare className="w-3 h-3 mt-0.5 text-slate-400 shrink-0" />
                        <span className="leading-snug">
                          <span className="font-bold">Reviewer:</span> {data.review.review_comment}
                        </span>
                      </div>
                    )}

                    {/* Section mini-bars */}
                    <div className="space-y-1.5 pt-1">
                      {(data.sections || []).slice(0, 4).map((s, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500 truncate w-36 sm:w-44">{s.section_name}</span>
                          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${scoreTone(s.score_percent).bg}`}
                              style={{ width: `${Math.max(2, s.score_percent)}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-black ${scoreTone(s.score_percent).text} w-9 text-right`}>
                            {s.score_percent}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ===== Failed items & evidence ===== */}
              {failedItems.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Failed Items &amp; Evidence
                  </div>
                  {failedItems.map((r, i) => {
                    const critical = isTrue(r.critical_question);
                    const shot = (r.evidence || [])[0];
                    return (
                      <div key={i} className="rounded-2xl border border-slate-200 bg-white p-3 flex items-center gap-3">
                        <EvidenceThumb evidence={shot} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-800 leading-snug">{r.question_text}</div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-slate-400">{r.section_name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${
                              critical
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                              {critical ? 'Critical' : 'Fail'}
                            </span>
                            {(r.evidence || []).length > 1 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600">
                                <Paperclip className="w-3 h-3" /> {r.evidence.length} files
                              </span>
                            )}
                          </div>
                          {r.comment && (
                            <div className="text-[10px] text-slate-500 italic mt-1 leading-snug">{r.comment}</div>
                          )}
                        </div>
                        {shot?.file_url && (
                          <a
                            href={shot.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" /> View photo
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ===== Tabs: Responses | Actions ===== */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setTab('responses')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    tab === 'responses' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <ClipboardCheck className="w-3.5 h-3.5" /> Responses ({(data.responses || []).length})
                </button>
                <button
                  onClick={() => setTab('actions')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    tab === 'actions' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" /> Actions ({(data.actions || []).length})
                </button>
              </div>

              {/* ===== Responses list (grouped, collapsible sections) ===== */}
              {tab === 'responses' && (
                <div className="space-y-2.5">
                  {grouped.length === 0 && (
                    <div className="text-center py-10 text-xs text-slate-400 font-semibold">
                      No responses recorded for this audit.
                    </div>
                  )}
                  {grouped.map((g, gi) => {
                    const sec = (data.sections || []).filter(s => s.section_name === g.section)[0] || {};
                    const secScore = sec.score_percent || 0;
                    const isOpen = openSection === gi;
                    return (
                      <div key={gi} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                        <button
                          onClick={() => setOpenSection(isOpen ? null : gi)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50/80 transition-colors cursor-pointer text-left"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isOpen
                              ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                              : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 text-[11px] font-black">
                              {gi + 1}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-800 truncate">{g.section}</div>
                              <div className="text-[10px] text-slate-400 font-semibold">
                                {g.rows.length} questions · {sec.failures || 0} failures
                              </div>
                            </div>
                          </div>
                          <span className={`text-xs font-black ${scoreTone(secScore).text}`}>{secScore}%</span>
                        </button>

                        {isOpen && (
                          <div className="border-t border-slate-100 divide-y divide-slate-100">
                            {g.rows.map((r, ri) => (
                              <div key={ri} className="px-4 py-3 space-y-1.5">
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-[11px] font-semibold text-slate-700 leading-snug">
                                    {r.question_text}
                                    {isTrue(r.critical_question) && (
                                      <span className="inline-flex items-center gap-1 ml-1.5 px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-600 text-[8px] font-black uppercase">
                                        <ShieldAlert className="w-2.5 h-2.5" /> Critical
                                      </span>
                                    )}
                                  </p>
                                  <span className={`shrink-0 px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${
                                    isTrue(r.is_failure) ? 'bg-rose-50 text-rose-600 border-rose-200'
                                    : isTrue(r.is_na) ? 'bg-slate-100 text-slate-500 border-slate-200'
                                    : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                                    {isTrue(r.is_failure) ? 'Fail' : isTrue(r.is_na) ? 'N/A' : 'Pass'}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                                  <span className="font-bold text-slate-600">
                                    Response: <span className="font-mono font-medium text-slate-800">
                                      {isTrue(r.is_na) ? 'N/A' : (r.response_value || '—')}
                                    </span>
                                  </span>
                                  <span className="font-bold text-slate-400">
                                    Score: <span className="text-slate-700">{r.score}/{r.max_score}</span>
                                  </span>
                                  {(r.evidence || []).map((e, ei) => (
                                    e.file_url ? (
                                      <a
                                        key={ei}
                                        href={e.file_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-blue-600 font-bold hover:underline"
                                      >
                                        <Paperclip className="w-3 h-3" /> {e.file_name || `Evidence ${ei + 1}`}
                                      </a>
                                    ) : null
                                  ))}
                                </div>

                                {r.comment && (
                                  <div className="flex items-start gap-1.5 text-[10px] text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
                                    <MessageSquare className="w-3 h-3 mt-0.5 text-slate-400 shrink-0" />
                                    <span className="leading-snug italic">{r.comment}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ===== Actions list ===== */}
              {tab === 'actions' && (
                <div className="space-y-2.5">
                  {(data.actions || []).length === 0 && (
                    <div className="text-center py-10 text-xs text-slate-400 font-semibold">
                      No corrective actions were raised for this audit. 🎉
                    </div>
                  )}
                  {(data.actions || []).map((a, i) => (
                    <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        String(a.priority).toUpperCase() === 'CRITICAL'
                          ? 'bg-rose-50 text-rose-600 border border-rose-200'
                          : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                        <Wrench className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-800 leading-snug">{a.title}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{a.description}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${
                            String(a.priority).toUpperCase() === 'CRITICAL'
                              ? 'bg-rose-50 text-rose-600 border-rose-200'
                              : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                            {a.priority}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${
                            String(a.status).toUpperCase() === 'OPEN'
                              ? 'bg-blue-50 text-blue-600 border-blue-200'
                              : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                            {a.status}
                          </span>
                          {a.risk_category && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500 text-[9px] font-bold uppercase">
                              {a.risk_category}
                            </span>
                          )}
                          {a.owner_email && (
                            <span className="text-[9px] font-bold text-slate-400">{a.owner_email}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {!loading && data && (
          <div className="px-5 sm:px-7 py-3.5 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3 shrink-0">
            <div className="text-[10px] text-slate-500 font-semibold truncate">
              {trackMsg || `Generated ${fmtDateTime(new Date().toISOString())}`}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="sm:hidden flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
              {/* {failedItems.length > 0 && (
                <button
                  onClick={handleTrackFindings}
                  disabled={tracking}
                  className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {tracking
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Tracking…</>
                    : <><Flag className="w-3.5 h-3.5" /> Track these findings</>}
                </button>
              )} */}
              <button
                onClick={onClose}
                className="text-xs font-bold px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}