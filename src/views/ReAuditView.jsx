import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';

import { supabase } from '../supabaseClient';

const STATUS_OPTIONS = [
  'ALL',
  'OPEN',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
  'CANCELLED'
];

const STATUS_STYLES = {
  OPEN: 'bg-purple-50 text-purple-700 border-purple-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200'
};

const normalize = (value) => {
  return String(value || '').trim().toUpperCase();
};

const formatDate = (value) => {
  if (!value) return 'N/A';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

export default function ReAuditView({ currentUser }) {
  const [requests, setRequests] = useState([]);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [clusterFilter, setClusterFilter] = useState('ALL');

  const loadRequests = async () => {
    setLoading(true);
    setMessage('');

    const [
      requestsResult,
      auditsResult
    ] = await Promise.all([
      supabase
        .from('re_audit_requests')
        .select('*')
        .order('created_at', { ascending: false }),

      supabase
        .from('audits')
        .select('*')
    ]);

    if (requestsResult.error) {
      setMessage(requestsResult.error.message);
      setRequests([]);
    } else {
      setRequests(requestsResult.data || []);
    }

    if (auditsResult.error) {
      setMessage(auditsResult.error.message);
      setAudits([]);
    } else {
      setAudits(auditsResult.data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const auditMap = useMemo(() => {
    return new Map(
      audits.map((audit) => [
        String(audit.audit_id),
        audit
      ])
    );
  }, [audits]);

  const enrichedRequests = useMemo(() => {
    return requests.map((request) => ({
      ...request,
      audit: auditMap.get(String(request.audit_id)) || null
    }));
  }, [requests, auditMap]);

  const getCluster = (audit = {}) => String(
    audit.cluster_name || audit.cluster || audit.location_cluster || audit.region || ''
  ).trim();

  const clusterOptions = useMemo(() => [...new Set(
    enrichedRequests.map(({ audit }) => getCluster(audit || '')).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b)), [enrichedRequests]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return enrichedRequests.filter((request) => {
      const status = normalize(request.status);
      const audit = request.audit || {};

      const matchesStatus =
        statusFilter === 'ALL' || status === statusFilter;
      const cluster = getCluster(audit);
      const matchesCluster = clusterFilter === 'ALL' || cluster.toLowerCase() === clusterFilter.toLowerCase();

      const searchableText = [
        request.audit_id,
        request.requested_by_email,
        request.reason,
        request.status,
        audit.template_name,
        audit.auditor_name,
        audit.auditor_email,
        audit.location_id,
        cluster
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      const matchesSearch =
        !query || searchableText.includes(query);

      return matchesStatus && matchesCluster && matchesSearch;
    });
  }, [enrichedRequests, search, statusFilter, clusterFilter]);

  const updateRequestStatus = async (request, nextStatus) => {
    setSaving(true);
    setMessage('');

    const { error } = await supabase
      .from('re_audit_requests')
      .update({
        status: nextStatus
      })
      .eq('audit_id', request.audit_id)
      .eq('status', request.status);

    if (error) {
      setSaving(false);
      setMessage(error.message);
      return;
    }

    setSaving(false);
    setMessage(`Re-audit request marked as ${nextStatus}.`);

    await loadRequests();
  };

  if (loading) {
    return (
      <div className="p-8 text-sm font-semibold text-slate-500">
        Loading re-audit requests...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="ml-auto items-end md:flex-row md:items-end">
        <button
          onClick={loadRequests}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {message && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-700">
          {message}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_200px_200px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search re-audit requests..."
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-purple-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-purple-500"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status === 'ALL' ? 'All statuses' : status}
              </option>
            ))}
          </select>
          <select
            value={clusterFilter}
            onChange={(event) => setClusterFilter(event.target.value)}
            aria-label="Filter by cluster"
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-purple-500"
          >
            <option value="ALL">All clusters</option>
            {clusterOptions.map((cluster) => <option key={cluster} value={cluster}>{cluster}</option>)}
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {filteredRequests.length === 0 && (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-slate-500">
              No re-audit requests found.
            </p>
          </div>
        )}

        {filteredRequests.length > 0 && <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>{['Audit', 'Cluster', 'Audit ID', 'Requested by', 'Auditor', 'Location', 'Score', 'Requested', 'Status', 'Reason', 'Actions'].map((heading) => <th key={heading} className="px-4 py-3 font-bold">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
        {filteredRequests.map((request) => {
          const audit = request.audit || {};
          const status = normalize(request.status);

          return (
            <tr
              key={`${request.audit_id}-${request.created_at}`}
              className="align-top text-slate-700"
            >
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {audit.template_name ||
                        request.audit_id}
                    </td>
                    <td className="px-4 py-3">{getCluster(audit) || 'N/A'}</td>
                    <td className="px-4 py-3">{request.audit_id}</td>
                    <td className="px-4 py-3">{request.requested_by_email || 'N/A'}</td>
                    <td className="px-4 py-3">{audit.auditor_name || audit.auditor_email || 'N/A'}</td>
                    <td className="px-4 py-3">{audit.location_id || 'N/A'}</td>
                    <td className="px-4 py-3">{audit.score_percent ?? 0}%</td>
                    <td className="px-4 py-3">{formatDate(request.created_at)}</td>
                    <td className="px-4 py-3">
                    <span
                      className={`rounded-md border px-2 py-1 text-[10px] font-bold ${
                        STATUS_STYLES[status] ||
                        'border-slate-200 bg-slate-100 text-slate-600'
                      }`}
                    >
                      {status || 'OPEN'}
                    </span></td>
                    <td className="max-w-[220px] whitespace-normal px-4 py-3">{request.reason || 'No reason provided.'}</td>
                    <td className="px-4 py-3"><div className="flex flex-wrap gap-2">
                  {status === 'OPEN' && (
                    <>
                      <button
                        disabled={saving}
                        onClick={() =>
                          updateRequestStatus(
                            request,
                            'IN_PROGRESS'
                          )
                        }
                        className="flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        <Clock className="h-4 w-4" />
                        Start Review
                      </button>

                      <button
                        disabled={saving}
                        onClick={() =>
                          updateRequestStatus(
                            request,
                            'REJECTED'
                          )
                        }
                        className="flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    </>
                  )}

                  {status === 'IN_PROGRESS' && (
                    <button
                      disabled={saving}
                      onClick={() =>
                        updateRequestStatus(
                          request,
                          'COMPLETED'
                        )
                      }
                      className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Mark Completed
                    </button>
                  )}

                </div></td>
            </tr>
          );
        })}
            </tbody>
          </table>
        </div>}
      </section>
    </div>
  );
}
