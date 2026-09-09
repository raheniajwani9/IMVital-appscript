import { useState, useEffect } from 'react';
import {
  ShieldCheck, ClipboardCheck, TrendingUp, AlertTriangle,
  RefreshCw, MapPin, Activity, Award, BarChart3, PieChart,
  Target, CheckCircle2, XCircle, Star, FileText
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart as RPie, Pie, Cell, Tooltip, Legend,
  BarChart as RBar, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart as RArea, Area,
  RadialBarChart, RadialBar
} from 'recharts';

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

/* ---- Vertical Bar ---- */
function VBar({ data, dataKey, xKey, height = 200 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RBar data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip {...tooltipStyle} cursor={{ fill: '#f8fafc' }} />
        <Bar dataKey={dataKey} radius={[6, 6, 0, 0]}>
          {data.map((entry, i) => <Cell key={i} fill={entry.color || '#3b82f6'} />)}
        </Bar>
      </RBar>
    </ResponsiveContainer>
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

/* ---- Area Chart ---- */
function Timeline({ data, height = 200 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RArea data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="audAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip {...tooltipStyle} cursor={{ stroke: '#3b82f6', strokeWidth: 1 }} />
        <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#audAreaGrad)" dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} />
      </RArea>
    </ResponsiveContainer>
  );
}

/* ---- Progress Ring ---- */
function ProgressRing({ value, color = '#10b981', size = 200 }) {
  return (
    <ResponsiveContainer width="100%" height={size}>
      <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={12} data={[{ name: 'compliance', value: value, fill: color }]} startAngle={90} endAngle={-270}>
        <RadialBar background={{ fill: '#f1f5f9' }} dataKey="value" cornerRadius={6} />
        <text x="50%" y="48%" textAnchor="middle" className="fill-slate-900" style={{ fontSize: '22px', fontWeight: 900 }}>{value}%</text>
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

/* ---- Defaults ---- */
const DEFAULTS = {
  kpis: { totalAudits: 0, submittedCount: 0, inProgressCount: 0, passedCount: 0, failedCount: 0, avgScore: 0, passRate: 0, openActionsCount: 0, complianceScore: 0 },
  scoreDistribution: [], statusBreakdown: [], passFail: [], byLocation: [], byTemplate: [],
  riskDistribution: [], recentAudits: [], ratingDistribution: [], activityTimeline: []
};

/* ---- Main Component ---- */
export default function AuditorDashboard({ currentUser, onRefresh }) {
  const [data, setData] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    if (typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler((result) => {
          setData({ ...DEFAULTS, ...result });
          setLoading(false);
        })
        .withFailureHandler((err) => {
          console.error('Auditor dashboard fetch error:', err);
          setLoading(false);
        })
        .getAuditorDashboardData({
          email: currentUser?.email || '',
          user_id: currentUser?.user_id || ''
        });
    } else {
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

          {/* Compliance + Pass/Fail + Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartCard title="My Compliance Score" icon={Target}>
              <ProgressRing
                value={k.complianceScore}
                color={k.complianceScore >= 75 ? '#10b981' : k.complianceScore >= 50 ? '#f59e0b' : '#ef4444'}
              />
              <div className="flex items-center justify-center gap-2 text-xs mt-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="font-bold text-slate-600">{k.passedCount} passed</span>
                <span className="text-slate-300">·</span>
                <XCircle className="w-4 h-4 text-rose-500" />
                <span className="font-bold text-slate-600">{k.failedCount} failed</span>
              </div>
            </ChartCard>

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

          {/* Score distribution + Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Score Distribution" icon={BarChart3}>
              <VBar data={data.scoreDistribution} dataKey="count" xKey="range" />
            </ChartCard>

            <ChartCard title="My Activity (Last 14 Days)" icon={Activity}>
              <Timeline data={data.activityTimeline} />
            </ChartCard>
          </div>

          {/* By location + By template */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="My Audits by Location" icon={MapPin}>
              <HBar data={data.byLocation} dataKey="auditCount" labelKey="location" color="#0ea5e9" />
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                {data.byLocation.slice(0, 4).map((l, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-500">{l.location}</span>
                    <span className="font-bold text-slate-700">avg {l.avgScore}% · {l.failures} fail</span>
                  </div>
                ))}
              </div>
            </ChartCard>

            <ChartCard title="My Audits by Template" icon={FileText}>
              <HBar data={data.byTemplate} dataKey="auditCount" labelKey="template" color="#6366f1" />
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                {data.byTemplate.slice(0, 4).map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-500">{t.template}</span>
                    <span className="font-bold text-slate-700">avg {t.avgScore}% · {t.failures} fail</span>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>

          {/* Recent audits table */}
          <ChartCard title="My Recent Audits" icon={Award}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left border-b border-slate-100">
                    <th className="pb-2 pr-3 font-bold text-slate-400 uppercase tracking-wider text-[10px]">Template</th>
                    <th className="pb-2 pr-3 font-bold text-slate-400 uppercase tracking-wider text-[10px]">Location</th>
                    <th className="pb-2 pr-3 font-bold text-slate-400 uppercase tracking-wider text-[10px] text-right">Score</th>
                    <th className="pb-2 pr-3 font-bold text-slate-400 uppercase tracking-wider text-[10px] text-center">Result</th>
                    <th className="pb-2 pr-3 font-bold text-slate-400 uppercase tracking-wider text-[10px] text-center">Fails</th>
                    <th className="pb-2 font-bold text-slate-400 uppercase tracking-wider text-[10px] text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentAudits.length > 0 ? data.recentAudits.map((a, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 pr-3 font-semibold text-slate-700 truncate max-w-[140px]">{a.template_name}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{a.location_id}</td>
                      <td className="py-2.5 pr-3 text-right">
                        <span className={`font-black ${a.score_percent >= 75 ? 'text-emerald-600' : a.score_percent >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                          {a.score_percent}%
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${a.result === 'PASSED' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          {a.result}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-center">
                        <span className="font-bold text-slate-600">{a.failure_count}</span>
                        {a.critical_failures > 0 && <span className="ml-1 text-[9px] font-bold text-rose-500">({a.critical_failures} crit)</span>}
                      </td>
                      <td className="py-2.5 text-right text-slate-400 font-medium">
                        {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="py-8 text-center text-slate-400 font-semibold">No submitted audits yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </ChartCard>

          {/* Rating distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="My Rating Distribution" icon={Star}>
              {data.ratingDistribution.length > 0 ? (
                <HBar data={data.ratingDistribution} dataKey="count" labelKey="rating" color="#f59e0b" />
              ) : (
                <div className="text-center py-10 text-xs text-slate-400 font-semibold">No ratings yet</div>
              )}
            </ChartCard>

            <ChartCard title="My Risk Distribution (Failures)" icon={AlertTriangle}>
              {data.riskDistribution.length > 0 ? (
                <HBar data={data.riskDistribution} dataKey="count" labelKey="risk" color="#f97316" />
              ) : (
                <div className="text-center py-10 text-xs text-emerald-500 font-semibold flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-8 h-8" />
                  No failures recorded
                </div>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
