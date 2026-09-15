import React from 'react';
import {
  ResponsiveContainer, PieChart as RPie, Pie, Cell, Tooltip, Legend,
  BarChart as RBar, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart as RArea, Area, LineChart as RLine, Line,
  RadialBarChart, RadialBar
} from 'recharts';

export const tooltipStyle = {
  contentStyle: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px',
    fontSize: '12px', fontWeight: '600', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '8px 12px'
  },
  labelStyle: { color: '#64748b', marginBottom: '4px' },
  itemStyle: { color: '#1e293b' }
};

export function KpiCard({ icon: Icon, label, value, sub, color, bg, border, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border ${border} shadow-sm p-4 flex items-center gap-4 ${
        onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
      }`}
    >
      <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
        <div className="text-2xl font-black text-slate-900 leading-tight">{value}</div>
        {sub && <div className="text-[10px] font-semibold text-slate-400 truncate">{sub}</div>}
      </div>
    </div>
  );
}

export function ChartCard({ title, icon: Icon, action, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-slate-400" />}
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function Empty({ children = 'No data yet', icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-xs font-semibold text-slate-400">
      {Icon && <Icon className="w-8 h-8 text-slate-300" />}
      {children}
    </div>
  );
}

export function Donut({ data, centerLabel, centerValue, height = 220 }) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <RPie>
          <Pie data={data} dataKey="count" nameKey="label" cx="50%" cy="50%"
            innerRadius={55} outerRadius={80} paddingAngle={2}>
            {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip {...tooltipStyle} />
          <Legend iconType="circle" iconSize={8}
            wrapperStyle={{ fontSize: '11px', fontWeight: '600', marginTop: '8px' }} />
        </RPie>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        style={{ top: '-30px' }}>
        {centerLabel && (
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{centerLabel}</span>
        )}
        {centerValue !== undefined && (
          <span className="text-xl font-black text-slate-900">{centerValue}</span>
        )}
      </div>
    </div>
  );
}

export function VBar({ data, dataKey, xKey, height = 200, color = '#3b82f6' }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RBar data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip {...tooltipStyle} cursor={{ fill: '#f8fafc' }} />
        <Bar dataKey={dataKey} radius={[6, 6, 0, 0]}>
          {data.map((entry, i) => <Cell key={i} fill={entry.color || color} />)}
        </Bar>
      </RBar>
    </ResponsiveContainer>
  );
}

export function HBar({ data, dataKey, labelKey, color = '#3b82f6', height = 220, labelWidth = 100 }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(height, data.length * 34 + 40)}>
      <RBar layout="vertical" data={data} margin={{ top: 0, right: 24, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey={labelKey}
          tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
          axisLine={false} tickLine={false} width={labelWidth} />
        <Tooltip {...tooltipStyle} cursor={{ fill: '#f8fafc' }} />
        <Bar dataKey={dataKey} fill={color} radius={[0, 6, 6, 0]} barSize={20} />
      </RBar>
    </ResponsiveContainer>
  );
}

/** Volume area + optional avg-score line on a second axis. */
export function TrendArea({ data, height = 240, showScore = true, gradientId = 'adminTrend' }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RArea data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#94a3b8' }}
          axisLine={false} tickLine={false} allowDecimals={false} />
        {showScore && (
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%"
            tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
        )}
        <Tooltip {...tooltipStyle} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
        <Area yAxisId="left" name="Audits" type="monotone" dataKey="count"
          stroke="#3b82f6" strokeWidth={2} fill={`url(#${gradientId})`} dot={{ r: 3, fill: '#3b82f6' }} />
        {showScore && (
          <Area yAxisId="right" name="Avg score %" type="monotone" dataKey="avgScore"
            stroke="#10b981" strokeWidth={2} fill="transparent"
            dot={{ r: 3, fill: '#10b981' }} connectNulls />
        )}
      </RArea>
    </ResponsiveContainer>
  );
}

export function ProgressRing({ value, color = '#10b981', size = 200 }) {
  return (
    <ResponsiveContainer width="100%" height={size}>
      <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={12}
        data={[{ name: 'compliance', value, fill: color }]} startAngle={90} endAngle={-270}>
        <RadialBar background={{ fill: '#f1f5f9' }} dataKey="value" cornerRadius={6} />
        <text x="50%" y="48%" textAnchor="middle" className="fill-slate-900"
          style={{ fontSize: '22px', fontWeight: 900 }}>{value}%</text>
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

export { RLine, Line };