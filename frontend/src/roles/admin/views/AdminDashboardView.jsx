import React, { useMemo, useState } from 'react';
import {
  ShieldCheck, ClipboardCheck, AlertTriangle, TrendingUp, MapPin,
  Users, FileText, CalendarClock, Layers,
  CheckCircle2, HelpCircle, Building2, Flame
} from 'lucide-react';
import {
  KpiCard, ChartCard, Donut, VBar, HBar, Empty
} from '../../../shared/components/Charts';
import { computeAdminAnalytics, distinctValues } from '../../../features/admin/utils/adminAnalytics';

const WINDOW_DAYS = null;

const shortDate = (v) =>
  v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

const scoreClass = (n) =>
  n >= 75 ? 'text-emerald-600' : n >= 50 ? 'text-amber-600' : 'text-rose-600';

const Th = ({ children, align = 'left' }) => (
  <th className={`pb-2 pr-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-${align}`}>
    {children}
  </th>
);

function Select({ value, onChange, options, placeholder, label }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <select aria-label={`${label} filter`} value={value} onChange={(e) => onChange(e.target.value)} className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={typeof o === 'object' ? o.value : o} value={typeof o === 'object' ? o.value : o}>{typeof o === 'object' ? o.label : o}</option>)}
      </select>
    </label>
  );
}

export default function AdminDashboardView({ data = {}, loading, onRefreshData }) {
  const [cluster, setCluster] = useState('');
  const [template, setTemplate] = useState('');
  const [auditor, setAuditor] = useState('');

  // 1. BULLETPROOF CLUSTER EXTRACTION
  const clusterOptions = useMemo(() => {
    const set = new Set();
    const sources = [
      ...(data.locations || []),
      ...(data.audits || []),
      ...(data.schedules || [])
    ];

    sources.forEach((item) => {
      const val = item.cluster || item.Cluster || item.cluster_name || item.home_cluster
        || item.location_cluster || item.region || item.area;
      if (val && String(val).trim()) {
        set.add(String(val).trim());
      }
    });

    return Array.from(set).sort();
  }, [data.locations, data.audits, data.schedules]);

  // 2. TEMPLATE OPTIONS
  const templateOptions = useMemo(
    () => distinctValues([...(data.templates || []), ...(data.audits || [])], 'template_name'),
    [data.templates, data.audits]
  );

  // 3. AUDITORS OPTIONS
  const auditorOptions = useMemo(() => {
    const list = [];
    const seen = new Set();

    // From Users table
    (data.users || []).forEach((u) => {
      const role = String(u.role || '').toLowerCase();
      if (role === 'auditor' || role === 'user') {
        const name = u.full_name || u.name || u.email;
        const email = u.email;
        if (email && !seen.has(email.toLowerCase())) {
          seen.add(email.toLowerCase());
          list.push({ label: name ? `${name} (${email})` : email, value: email });
        }
      }
    });

    // Fallback: From existing Audits table
    (data.audits || []).forEach((a) => {
      const email = a.auditor_email || a.auditor_id;
      const name = a.auditor_name || email;
      if (email && !seen.has(String(email).toLowerCase())) {
        seen.add(String(email).toLowerCase());
        list.push({ label: name ? `${name} (${email})` : email, value: email });
      }
    });

    return list;
  }, [data.users, data.audits]);

  const a = useMemo(
    () => computeAdminAnalytics(data, { days: WINDOW_DAYS, cluster, template, auditor }),
    [data, cluster, template, auditor]
  );

  const k = a.kpis;

  return (
    <div className="space-y-5 font-sans text-slate-800">
      {/* Header + filters */}
      <div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Program Dashboard</h1>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            {cluster && ` · ${cluster}`}
            {template && ` · ${template}`}
            {auditor && ` · Auditor: ${auditor}`}
          </p>
        </div>

      </div>

      <section aria-label="Dashboard filters" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">Filter dashboard</h2>
          {(cluster || template || auditor) && <button type="button" onClick={() => { setCluster(''); setTemplate(''); setAuditor(''); }} className="text-xs font-bold text-blue-600 hover:text-blue-700">Clear filters</button>}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Select label="Cluster" value={cluster} onChange={setCluster} options={clusterOptions} placeholder="All clusters" />
          <Select label="Form" value={template} onChange={setTemplate} options={templateOptions} placeholder="All forms" />
          <Select label="Auditor" value={auditor} onChange={setAuditor} options={auditorOptions} placeholder="All auditors" />
        </div>
      </section>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={ClipboardCheck} label="Audits" value={k.submittedCount}
          sub={`${k.inProgressCount} in progress · ${k.totalAudits} total`}
          color="text-blue-600" bg="bg-blue-50" border="border-blue-100" />
        <KpiCard icon={AlertTriangle} label="Open Actions" value={k.openActionsCount}
          sub={`${k.criticalOpenCount} critical · ${k.overdueActionsCount} overdue`}
          color="text-rose-600" bg="bg-rose-50" border="border-rose-100" />
        <KpiCard icon={CalendarClock} label="Overdue Schedules" value={k.overdueSchedulesCount}
          sub={`${k.dueThisWeekCount} due this week`}
          color="text-amber-600" bg="bg-amber-50" border="border-amber-100" />
        <KpiCard icon={CheckCircle2} label="Schedule Adherence" value={`${k.scheduleAdherence}%`}
          sub={`${k.activeSchedules} active schedules`}
          color="text-teal-600" bg="bg-teal-50" border="border-teal-100" />
        <KpiCard icon={Flame} label="Critical Failures" value={k.criticalFailures}
          sub={`${k.totalFailures} total failures`}
          color="text-orange-600" bg="bg-orange-50" border="border-orange-100" />
        <KpiCard icon={Users} label="Auditors" value={k.contributingAuditors}
          sub={`${k.idleAuditors} idle · ${k.activeAuditors} active`}
          color="text-indigo-600" bg="bg-indigo-50" border="border-indigo-100" />
      </div>

      {/* Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Audit Status" icon={Layers}>
          {a.statusBreakdown.length
            ? <Donut data={a.statusBreakdown} centerLabel="Total" centerValue={k.totalAudits} />
            : <Empty />}
        </ChartCard>

        <ChartCard title="Pass / Fail" icon={ShieldCheck}>
          {a.passFail.some((d) => d.count > 0)
            ? <Donut data={a.passFail} centerLabel="Submitted" centerValue={k.submittedCount} />
            : <Empty />}
        </ChartCard>

        <ChartCard title="Score Distribution" icon={TrendingUp}>
          {a.scoreDistribution.some((d) => d.count > 0)
            ? <VBar data={a.scoreDistribution} dataKey="count" xKey="range" height={220} />
            : <Empty />}
        </ChartCard>
      </div>

      {/* Cluster + form performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Cluster Leaderboard" icon={Building2}>
          {a.byCluster.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-slate-100">
                  <Th>Cluster</Th><Th align="right">Audits</Th>
                  <Th align="right">Avg</Th><Th align="right">Pass %</Th><Th align="right">Critical</Th>
                </tr></thead>
                <tbody>
                  {a.byCluster.map((c) => (
                    <tr key={c.cluster} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-2.5 pr-3 font-semibold text-slate-700">{c.cluster}</td>
                      <td className="py-2.5 pr-3 text-right font-bold text-slate-600">{c.auditCount}</td>
                      <td className={`py-2.5 pr-3 text-right font-black ${scoreClass(c.avgScore)}`}>{c.avgScore}%</td>
                      <td className="py-2.5 pr-3 text-right font-bold text-slate-600">{c.passRate}%</td>
                      <td className="py-2.5 text-right font-bold text-rose-600">{c.critical || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty />}
        </ChartCard>

        <ChartCard title="Form Performance" icon={FileText}>
          {a.byTemplate.length ? (
            <>
              <HBar data={a.byTemplate.slice(0, 8)} dataKey="auditCount" labelKey="template" color="#6366f1" />
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                {a.byTemplate.slice(0, 5).map((t) => (
                  <div key={t.template} className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-500 truncate max-w-[55%]">{t.template}</span>
                    <span className="font-bold text-slate-700">
                      avg <span className={scoreClass(t.avgScore)}>{t.avgScore}%</span> · {t.failures} fails
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : <Empty />}
        </ChartCard>
      </div>

      {/* Risk + worst PODs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Failures by Risk Category" icon={AlertTriangle}>
          {a.riskDistribution.length
            ? <HBar data={a.riskDistribution.slice(0, 10)} dataKey="count" labelKey="risk" color="#f97316" />
            : <Empty icon={CheckCircle2}>No failures recorded</Empty>}
        </ChartCard>

        <ChartCard title="Lowest Scoring PODs" icon={MapPin}>
          {a.worstPods.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-slate-100">
                  <Th>POD</Th><Th align="right">Audits</Th><Th align="right">Avg</Th><Th align="right">Critical</Th>
                </tr></thead>
                <tbody>
                  {a.worstPods.map((p) => (
                    <tr key={p.pod} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-2.5 pr-3 font-semibold text-slate-700 truncate max-w-[180px]">{p.pod}</td>
                      <td className="py-2.5 pr-3 text-right font-bold text-slate-600">{p.auditCount}</td>
                      <td className={`py-2.5 pr-3 text-right font-black ${scoreClass(p.avgScore)}`}>{p.avgScore}%</td>
                      <td className="py-2.5 text-right font-bold text-rose-600">{p.critical || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty />}
        </ChartCard>
      </div>

      {/* Top failing questions */}
      <ChartCard title="Top Failing Questions" icon={HelpCircle}>
        {a.topFailingQuestions.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-slate-100">
                <Th>Question</Th><Th>Section</Th><Th>Risk</Th>
                <Th align="right">Asked</Th><Th align="right">Failed</Th><Th align="right">Fail rate</Th>
              </tr></thead>
              <tbody>
                {a.topFailingQuestions.map((q, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-2.5 pr-3 font-semibold text-slate-700 max-w-[320px] truncate">
                      {q.critical && <span className="mr-1.5 text-[9px] font-black text-rose-500">CRIT</span>}
                      {q.question}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-500 truncate max-w-[140px]">{q.section}</td>
                    <td className="py-2.5 pr-3 text-slate-500">{q.risk}</td>
                    <td className="py-2.5 pr-3 text-right font-bold text-slate-600">{q.asked}</td>
                    <td className="py-2.5 pr-3 text-right font-bold text-rose-600">{q.failed}</td>
                    <td className={`py-2.5 text-right font-black ${q.failRate >= 50 ? 'text-rose-600' : 'text-amber-600'}`}>
                      {q.failRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty icon={CheckCircle2}>No question-level failures</Empty>}
      </ChartCard>

      {/* Auditor leaderboard */}
      <ChartCard title="Auditor Performance" icon={Users}>
        {a.byAuditor.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-slate-100">
                <Th>Auditor</Th><Th>Cluster</Th>
                <Th align="right">Submitted</Th><Th align="right">Avg score</Th>
                <Th align="right">Critical</Th><Th align="right">Turnaround</Th><Th align="right">Pending</Th>
              </tr></thead>
              <tbody>
                {a.byAuditor.map((u) => (
                  <tr key={u.email} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-slate-700">{u.name}</div>
                      <div className="text-[10px] text-slate-400">{u.email}</div>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-500">{u.cluster}</td>
                    <td className="py-2.5 pr-3 text-right font-bold text-slate-600">{u.auditCount}</td>
                    <td className={`py-2.5 pr-3 text-right font-black ${u.auditCount ? scoreClass(u.avgScore) : 'text-slate-300'}`}>
                      {u.auditCount ? `${u.avgScore}%` : '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-bold text-rose-600">{u.critical || '—'}</td>
                    <td className="py-2.5 pr-3 text-right text-slate-500 font-semibold">
                      {u.avgTurnaroundHrs ? `${u.avgTurnaroundHrs} h` : '—'}
                    </td>
                    <td className="py-2.5 text-right font-bold text-amber-600">{u.pending || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty />}
      </ChartCard>

      {/* Coverage gaps + critical failures */}
      <div className="grid grid-cols-1 gap-4">
        <ChartCard title="Recent Critical Failures" icon={Flame}>
          {a.criticalAudits.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-slate-100">
                  <Th>Form</Th><Th>POD</Th><Th align="right">Score</Th>
                  <Th align="right">Crit</Th><Th align="right">Date</Th>
                </tr></thead>
                <tbody>
                  {a.criticalAudits.map((x) => (
                    <tr key={x.audit_id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-2.5 pr-3 font-semibold text-slate-700 truncate max-w-[140px]">{x.template_name}</td>
                      <td className="py-2.5 pr-3 text-slate-500 truncate max-w-[120px]">{x.location_id}</td>
                      <td className={`py-2.5 pr-3 text-right font-black ${scoreClass(x.score_percent)}`}>{x.score_percent}%</td>
                      <td className="py-2.5 pr-3 text-right font-black text-rose-600">{x.critical}</td>
                      <td className="py-2.5 text-right text-slate-400 font-medium">{shortDate(x.submitted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty icon={CheckCircle2}>No critical failures</Empty>}
        </ChartCard>
      </div>

    </div>
  );
}
