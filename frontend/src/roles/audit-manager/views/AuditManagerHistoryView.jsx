import React, { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { supabase } from '../../../shared/lib/supabaseClient';

const formatDate = (value) => value ? new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';

const STATUS_BADGE_STYLES = {
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  REJECTED: 'border-rose-200 bg-rose-50 text-rose-700',
  RE_AUDIT_REQUESTED: 'border-violet-200 bg-violet-50 text-violet-700',
  CLOSED: 'border-slate-300 bg-slate-100 text-slate-700',
  PENDING_REVIEW: 'border-blue-200 bg-blue-50 text-blue-700'
};

export default function AuditManagerHistoryView() {
  const [audits, setAudits] = useState([]);
  const [locations, setLocations] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [cluster, setCluster] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    const [{ data, error }, locationsResult] = await Promise.all([
      supabase.from('audits').select('*').order('reviewed_at', { ascending: false }),
      supabase.from('locations').select('*')
    ]);
    if (error) setMessage(error.message);
    setAudits(data || []);
    if (locationsResult.error) setMessage(locationsResult.error.message);
    setLocations(locationsResult.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const getAuditCluster = (audit) => {
    const direct = audit.cluster_name || audit.cluster || audit.location_cluster || audit.region;
    if (direct) return String(direct).trim();
    const locationId = String(audit.location_id || audit.pod_id || '').trim().toLowerCase();
    const location = locations.find((item) => [item.pod_id, item.location_id, item['Location ID'], item.store_id, item['Store Name'], item.store_name, item.location_name]
      .some((value) => String(value || '').trim().toLowerCase() === locationId));
    return String(location?.cluster || location?.Cluster || location?.cluster_name || location?.['Cluster Name'] || location?.home_cluster || '').trim();
  };

  const clusterOptions = useMemo(() => [...new Set(audits.map(getAuditCluster).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b)), [audits, locations]);

  const filtered = useMemo(() => audits.filter((audit) => {
    const query = search.toLowerCase().trim();
    const reviewStatus = String(audit.review_status || 'PENDING_REVIEW').toUpperCase();
    const auditCluster = getAuditCluster(audit);
    const text = [audit.audit_id, audit.template_name, audit.auditor_name, audit.auditor_email, audit.location_id, audit.review_comment, auditCluster]
      .map((value) => String(value || '').toLowerCase()).join(' ');
    return (status === 'ALL' || reviewStatus === status) &&
      (cluster === 'ALL' || auditCluster.toLowerCase() === cluster.toLowerCase()) &&
      (!query || text.includes(query));
  }), [audits, search, status, cluster, locations]);

  if (loading) return <div className="p-8 text-sm font-semibold text-slate-500">Loading audit history...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div><span className="text-xs font-bold uppercase tracking-wider text-blue-600">Audit Manager</span><h1 className="text-2xl font-bold text-slate-900">Audit History</h1><p className="mt-1 text-sm text-slate-500">Review completed manager decisions and audit outcomes.</p></div>
        <button onClick={load} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>
      {message && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{message}</div>}
      <div className="grid gap-3 md:grid-cols-[1fr_220px_220px]">
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search audit history..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500" /></div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="ALL">All statuses</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="RE_AUDIT_REQUESTED">Re-audit requested</option><option value="CLOSED">Closed</option></select>
        <select value={cluster} onChange={(e) => setCluster(e.target.value)} aria-label="Filter by cluster" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="ALL">All clusters</option>{clusterOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm font-semibold text-slate-500">No history found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {['Audit', 'Audit ID', 'Location', 'Auditor', 'Score', 'Reviewed by', 'Reviewed at', 'Comment', 'Status'].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-bold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((audit) => {
                  const reviewStatus = String(audit.review_status || 'PENDING_REVIEW').toUpperCase();
                  return (
                    <tr key={audit.audit_id} className="align-top text-slate-700 hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-semibold text-slate-900">{audit.template_name || audit.audit_id}</td>
                      <td className="px-4 py-3">{audit.audit_id}</td>
                      <td className="px-4 py-3">{audit.location_id || 'N/A'}</td>
                      <td className="px-4 py-3">{audit.auditor_name || audit.auditor_email || 'N/A'}</td>
                      <td className="px-4 py-3">{audit.score_percent ?? 0}%</td>
                      <td className="px-4 py-3">{audit.reviewed_by || 'N/A'}</td>
                      <td className="px-4 py-3">{formatDate(audit.reviewed_at)}</td>
                      <td className="max-w-[260px] whitespace-normal px-4 py-3">{audit.review_comment || 'No comment'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-bold tracking-wide ${STATUS_BADGE_STYLES[reviewStatus] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                          {reviewStatus.replaceAll('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
