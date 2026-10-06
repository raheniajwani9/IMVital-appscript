import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, ClipboardCheck, TrendingUp, AlertTriangle,
  RefreshCw, MapPin, Activity
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart as RPie, Pie, Cell, Tooltip, Legend,
  BarChart as RBar, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { supabase } from '../../../shared/lib/supabaseClient'; // Import local data store client

/* ---- KpiCard ---- */
function KpiCard({ icon: Icon, label, value, sub, color, bg, border }) {
  return (
    <div className={`bg-white rounded-2xl border ${border} shadow-sm p-4 flex items-center gap-4`}>
      <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
        <div className="text-2xl font-black text-slate-900 leading-tight">{value}</div>
        {sub && <div className="text-[10px] font-semibold text-slate-400">{sub}</div>}
      </div>
    </div>
  );
}

/* ---- ChartCard ---- */
function ChartCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-slate-400" />
        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

const tooltipStyle = {
  contentStyle: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '12px', fontWeight: '600', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '8px 12px' },
  labelStyle: { color: '#64748b', marginBottom: '4px' },
  itemStyle: { color: '#1e293b' }
};

/* ---- Donut ---- */
function Donut({ data, centerLabel, centerValue, height = 220 }) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <RPie>
          <Pie data={data} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2}>
            {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip {...tooltipStyle} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', fontWeight: '600', marginTop: '8px' }} />
        </RPie>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: '-30px' }}>
        {centerLabel && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{centerLabel}</span>}
        {centerValue !== undefined && <span className="text-xl font-black text-slate-900">{centerValue}</span>}
      </div>
    </div>
  );
}

/* ---- Horizontal Bar ---- */
function HBar({ data, dataKey, labelKey, color = '#3b82f6', height = 220 }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(height, data.length * 38 + 40)}>
      <RBar layout="vertical" data={data} margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey={labelKey} tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} axisLine={false} tickLine={false} width={90} />
        <Tooltip {...tooltipStyle} cursor={{ fill: '#f8fafc' }} />
        <Bar dataKey={dataKey} fill={color} radius={[0, 6, 6, 0]} barSize={22} />
      </RBar>
    </ResponsiveContainer>
  );
}

/* ---- Defaults ---- */
const DEFAULTS = {
  kpis: { totalAudits: 0, submittedCount: 0, inProgressCount: 0, passedCount: 0, failedCount: 0, avgScore: 0, passRate: 0, openActionsCount: 0, complianceScore: 0 },
  scoreDistribution: [], statusBreakdown: [], passFail: [], byLocation: [], byTemplate: [],
  riskDistribution: [], recentAudits: [], ratingDistribution: [], activityTimeline: []
};

// Simple helper to process raw local data store data into the dashboard format
function processAuditorData(audits, actions, locations = []) {
  const submitted = audits.filter(a => a.status === 'SUBMITTED' || a.status === 'APPROVED' || a.status === 'COMPLETED');
  const inProgress = audits.filter(a => a.status === 'IN_PROGRESS');
  const passed = submitted.filter(a => a.result === 'PASSED');
  const failed = submitted.filter(a => a.result === 'FAILED');

  const avgScore = submitted.length > 0 
    ? Math.round(submitted.reduce((sum, a) => sum + (Number(a.score_percent) || 0), 0) / submitted.length)
    : 0;

  const kpis = {
    totalAudits: audits.length,
    submittedCount: submitted.length,
    inProgressCount: inProgress.length,
    passedCount: passed.length,
    failedCount: failed.length,
    avgScore,
    passRate: submitted.length ? Math.round((passed.length / submitted.length) * 100) : 0,
    openActionsCount: actions.filter(a => a.status === 'OPEN').length,
    complianceScore: avgScore
  };

  const statusMap = { SUBMITTED: 0, IN_PROGRESS: 0, SCHEDULED: 0, OVERDUE: 0 };
  audits.forEach(a => {
    if (a.status === 'SUBMITTED' || a.status === 'APPROVED') statusMap.SUBMITTED++;
    else if (a.status === 'IN_PROGRESS') statusMap.IN_PROGRESS++;
    else if (a.is_overdue) statusMap.OVERDUE++;
    else statusMap.SCHEDULED++;
  });

  const statusBreakdown = [
    { label: 'Submitted', count: statusMap.SUBMITTED, color: '#10b981' },
    { label: 'In Progress', count: statusMap.IN_PROGRESS, color: '#f59e0b' },
    { label: 'Scheduled', count: statusMap.SCHEDULED, color: '#3b82f6' },
    { label: 'Overdue', count: statusMap.OVERDUE, color: '#ef4444' }
  ].filter(i => i.count > 0);

  const passFail = [
    { label: 'Passed', count: passed.length, color: '#10b981' },
    { label: 'Failed', count: failed.length, color: '#ef4444' }
  ];

  const byLocationMap = new Map();
  audits.forEach((audit) => {
    const locationId = String(audit.location_id || audit.pod_id || '').trim();
    const location = locations.find((item) => [item.location_id, item.pod_id, item['Location ID'], item.store_id, item['Store Name'], item.store_name, item.location_name]
      .some((value) => String(value || '').trim().toLowerCase() === locationId.toLowerCase()));
    const label = location?.['Store Name'] || location?.store_name || location?.location_name || locationId || 'Unknown location';
    byLocationMap.set(label, (byLocationMap.get(label) || 0) + 1);
  });
  const byLocation = [...byLocationMap.entries()]
    .map(([location, auditCount]) => ({ location, auditCount }))
    .sort((a, b) => b.auditCount - a.auditCount || a.location.localeCompare(b.location));

  return {
    kpis,
    statusBreakdown,
    passFail,
    scoreDistribution: [], // Needs more complex bucketing logic based on your backend
    byLocation,
    byTemplate: [], // Simplified
    riskDistribution: [], // Simplified
    recentAudits: submitted.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)).slice(0, 10),
    ratingDistribution: [],
    activityTimeline: []
  };
}

/* ---- Main Component ---- */
export default function AuditorDashboard({ currentUser, onRefresh }) {
  const [data, setData] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: audits },
        { data: actions },
        { data: locations }
      ] = await Promise.all([
        supabase.from('audits').select('*').eq('auditor_id', currentUser.user_id),
        supabase.from('actions').select('*').eq('owner_email', currentUser.email),
        supabase.from('locations').select('*')
      ]);

      const processedData = processAuditorData(audits || [], actions || [], locations || []);
      setData({ ...DEFAULTS, ...processedData });
      setLoading(false);
    } catch (err) {
      console.error('Auditor dashboard fetch error:', err);
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [currentUser?.email]);

  const k = data.kpis;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            Your audit performance across all assignments
          </p>
        </div>
        <button
          onClick={() => { fetchData(); onRefresh && onRefresh(); }}
          className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="ml-3 text-sm font-bold text-slate-400">Loading…</span>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <KpiCard icon={ClipboardCheck} label="Total Audits" value={k.totalAudits}
              sub={`${k.submittedCount} submitted · ${k.inProgressCount} in progress`}
              color="text-blue-600" bg="bg-blue-50" border="border-blue-100" />
            <KpiCard icon={TrendingUp} label="Avg Score" value={`${k.avgScore}%`}
              sub="across submitted audits"
              color="text-emerald-600" bg="bg-emerald-50" border="border-emerald-100" />
            <KpiCard icon={ShieldCheck} label="Pass Rate" value={`${k.passRate}%`}
              sub={`${k.passedCount} passed · ${k.failedCount} failed`}
              color="text-violet-600" bg="bg-violet-50" border="border-violet-100" />
            <KpiCard icon={AlertTriangle} label="Open Actions" value={k.openActionsCount}
              sub="from your audits"
              color="text-rose-600" bg="bg-rose-50" border="border-rose-100" />
          </div>

          {/* Pass/Fail + Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Pass / Fail" icon={ShieldCheck}>
              {data.passFail.some(d => d.count > 0) ? (
                <Donut data={data.passFail} centerLabel="Audits" centerValue={k.submittedCount} />
              ) : (
                <div className="text-center py-10 text-xs text-slate-400 font-semibold">No submitted audits yet</div>
              )}
            </ChartCard>

            <ChartCard title="Audit Status" icon={Activity}>
              {data.statusBreakdown.length > 0 ? (
                <Donut data={data.statusBreakdown} centerLabel="Total" centerValue={k.totalAudits} />
              ) : (
                <div className="text-center py-10 text-xs text-slate-400 font-semibold">No audits yet</div>
              )}
            </ChartCard>
          </div>

          {/* Audits by location */}
          <div className="grid grid-cols-1 gap-4">
            <ChartCard title="My Audits by Location" icon={MapPin}>
              {data.byLocation.length > 0 ? (
                <HBar data={data.byLocation} dataKey="auditCount" labelKey="location" color="#0ea5e9" />
              ) : (
                <div className="py-10 text-center text-xs font-semibold text-slate-400">No audits with a location yet</div>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
