import React, { useEffect, useState } from 'react';
import { RefreshCw, History } from 'lucide-react';
import { supabase } from '../../../shared/lib/supabaseClient';

export default function ActionHistoryView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('action_history')
      .select('*')
      .order('created_at', { ascending: false });
    setRows(data || []);
    setError(queryError?.message || '');
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Audit Manager</span>
          <h1 className="text-2xl font-bold text-slate-900">Action History</h1>
          <p className="mt-1 text-sm text-slate-500">Review status changes and comments recorded for corrective actions.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        {loading ? <p className="p-6 text-sm text-slate-500">Loading action history…</p> : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500"><History className="mx-auto mb-2 h-6 w-6 text-slate-300" />No action history yet.</div>
        ) : (
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Date', 'Action', 'Audit', 'Change', 'Comment', 'Evidence'].map((label) => <th key={label} className="px-4 py-3 font-bold">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id || `${row.action_id}-${row.created_at}`}>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
              <td className="px-4 py-3 font-semibold text-slate-800">{row.action_id || '—'}</td>
              <td className="px-4 py-3 text-slate-600">{row.audit_id || '—'}</td>
              <td className="px-4 py-3 text-slate-700">{row.old_status || 'NEW'} → {row.new_status || '—'}</td>
              <td className="max-w-sm px-4 py-3 text-slate-600">{row.comment || '—'}</td>
              <td className="px-4 py-3 text-slate-600">{Array.isArray(row.evidence_uris) && row.evidence_uris.length > 0
                ? row.evidence_uris.map((evidence, index) => <a key={evidence.storage_path || evidence.file_url || index} href={evidence.file_url} target="_blank" rel="noreferrer" className="mr-2 font-semibold text-blue-700 underline">{evidence.file_name || `Evidence ${index + 1}`}</a>)
                : '—'}</td>
            </tr>)}</tbody>
          </table>
        )}
      </div>
    </section>
  );
}
