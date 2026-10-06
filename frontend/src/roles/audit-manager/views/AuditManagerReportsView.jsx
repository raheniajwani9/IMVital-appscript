import React, { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { supabase } from '../../../shared/lib/supabaseClient';

const csvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const downloadCsv = (filename, headers, rows) => {
  const content = [headers, ...rows].map((row) => row.map(csvValue).join(',')).join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export default function AuditManagerReportsView() {
  const [audits, setAudits] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    const [auditsResult, actionsResult] = await Promise.all([
      supabase.from('audits').select('*').order('submitted_at', { ascending: false }),
      supabase.from('actions').select('*').order('created_at', { ascending: false })
    ]);
    const error = auditsResult.error || actionsResult.error;
    if (error) setMessage(error.message);
    setAudits(auditsResult.data || []);
    setActions(actionsResult.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="p-8 text-sm font-semibold text-slate-500">Loading reports...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3"><div><span className="text-xs font-bold uppercase tracking-wider text-blue-600">Audit Manager</span><h1 className="text-2xl font-bold text-slate-900">Reports</h1><p className="mt-1 text-sm text-slate-500">Download audit and corrective-action data as CSV.</p></div><button onClick={load} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700"><RefreshCw className="h-4 w-4" /> Refresh</button></div>
      {message && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{message}</div>}
      <div className="grid gap-4 md:grid-cols-2">
        <ReportCard title="Audit Report" count={audits.length} onClick={() => downloadCsv('audit-report.csv', ['Audit ID', 'Template', 'Auditor', 'Location', 'Score', 'Status', 'Review Status', 'Submitted At'], audits.map((a) => [a.audit_id, a.template_name, a.auditor_name || a.auditor_email, a.location_id, a.score_percent, a.status, a.review_status, a.submitted_at]))} />
        <ReportCard title="Corrective Action Report" count={actions.length} onClick={() => downloadCsv('corrective-actions-report.csv', ['Action ID', 'Audit ID', 'Title', 'Owner', 'Location', 'Priority', 'Status', 'Risk Category', 'Due Date', 'Created At'], actions.map((a) => [a.action_id, a.audit_id, a.title || a.action_title, a.owner_email, a.location_id, a.priority, a.status, a.risk_category, a.due_date, a.created_at]))} />
      </div>
    </div>
  );
}

function ReportCard({ title, count, onClick }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-900">{title}</h2><p className="mt-2 text-sm text-slate-500">{count} records available</p><button onClick={onClick} className="mt-5 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white"><Download className="h-4 w-4" /> Download CSV</button></div>;
}
