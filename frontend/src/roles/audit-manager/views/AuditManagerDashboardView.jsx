import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Search,
  ShieldCheck
} from 'lucide-react';
import { supabase } from '../../../shared/lib/supabaseClient';

const status = (value) => String(value || '').trim().toUpperCase();

const formatStatus = (value) => {
  if (!value) return 'Unknown';
  return String(value)
    .trim()
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const formatDate = (value) => {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const getAuditDate = (audit) =>
  audit.submitted_at || audit.created_at || audit.started_at || null;

const getAuditTimestamp = (audit) => {
  const timestamp = new Date(getAuditDate(audit) || 0).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export default function AuditManagerDashboardView() {
  const [data, setData] = useState({
    audits: [],
    actions: [],
    requests: []
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const pageSize = 10;

  const load = async () => {
    setLoading(true);
    setMessage('');

    try {
      const [auditsResult, actionsResult, requestsResult] = await Promise.all([
        supabase.from('audits').select('*'),
        supabase.from('actions').select('*'),
        supabase.from('re_audit_requests').select('*')
      ]);

      const error =
        auditsResult.error ||
        actionsResult.error ||
        requestsResult.error;

      if (error) {
        setMessage(error.message);
      }

      setData({
        audits: auditsResult.data || [],
        actions: actionsResult.data || [],
        requests: requestsResult.data || []
      });
    } catch (error) {
      setMessage(error?.message || 'Unable to load the manager dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const metrics = useMemo(() => {
    const pendingReviews = data.audits.filter(
      (audit) =>
        ['SUBMITTED', 'COMPLETED'].includes(status(audit.status)) &&
        !['APPROVED', 'CLOSED'].includes(status(audit.review_status))
    ).length;

    const unresolvedActions = data.actions.filter(
      (action) => !['VERIFIED', 'CLOSED'].includes(status(action.status))
    );

    const overdueActions = unresolvedActions.filter(
      (action) =>
        action.due_date &&
        new Date(action.due_date).getTime() < Date.now()
    );

    return {
      pendingReviews,
      unresolvedActions: unresolvedActions.length,
      overdueActions: overdueActions.length,
      pendingVerification: data.actions.filter(
        (action) => status(action.status) === 'PENDING_VERIFICATION'
      ).length,
      reAudits: data.requests.filter(
        (request) =>
          !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(
            status(request.status)
          )
      ).length,
      criticalFailures: data.audits.reduce(
        (sum, audit) => sum + (Number(audit.critical_failures) || 0),
        0
      )
    };
  }, [data]);

  const statusOptions = useMemo(() => {
    const statuses = [
      ...new Set(data.audits.map((audit) => status(audit.status)).filter(Boolean))
    ].sort();

    return ['ALL', ...statuses];
  }, [data.audits]);

  const filteredAudits = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return [...data.audits]
      .filter((audit) => {

        if (criticalOnly &&(Number(audit.critical_failures) || 0) <= 0) {
        return false;
        }
        if (statusFilter !== 'ALL' && status(audit.status) !== statusFilter) {
          return false;
        }

        if (!query) return true;

        const searchableValues = [
          audit.template_name,
          audit.audit_id,
          audit.location_id,
          audit.location_name,
          audit.cluster_name,
          audit.auditor_name,
          audit.auditor_email,
          audit.status
        ];

        return searchableValues.some((value) =>
          String(value || '').toLowerCase().includes(query)
        );
      })
      .sort((a, b) => getAuditTimestamp(b) - getAuditTimestamp(a));
  }, [data.audits, searchQuery, statusFilter,criticalOnly]);

  const pageCount = Math.max(1, Math.ceil(filteredAudits.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedAudits = filteredAudits.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const updateSearch = (value) => {
    setSearchQuery(value);
    setPage(1);
  };

  const updateStatusFilter = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  if (loading) {
    return (
      <div className="p-8 text-sm font-semibold text-slate-500">
        Loading manager dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Audit Manager Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review audits, actions, and verification requests.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {message && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Metric
          icon={Clock}
          label="Pending Reviews"
          value={metrics.pendingReviews}
          color="blue"
        />
        <Metric
          icon={AlertTriangle}
          label="Unresolved Actions"
          value={metrics.unresolvedActions}
          color="amber"
        />
        <Metric
          icon={AlertTriangle}
          label="Overdue Actions"
          value={metrics.overdueActions}
          color="rose"
        />
        <Metric
          icon={ShieldCheck}
          label="Pending Verification"
          value={metrics.pendingVerification}
          color="violet"
        />
        <Metric
          icon={Clock}
          label="Open Re-audits"
          value={metrics.reAudits}
          color="cyan"
        />
        <button
          type="button"
          onClick={() => {
            setCriticalOnly((current) => !current);
            setPage(1);
          }}
          aria-pressed={criticalOnly}
          className={`rounded-xl border bg-white p-5 text-left shadow-sm transition hover:border-rose-300 hover:shadow ${
            criticalOnly ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-500">Critical Failures</p>
            <span className="inline-flex rounded-lg bg-rose-50 p-2 text-rose-700">
              <CheckCircle2 size={18} />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {metrics.criticalFailures}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {criticalOnly ? 'Click to clear filter' : 'Click to view affected audits'}
          </p>
        </button>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
              {criticalOnly ? 'Audits with Critical Failures' : 'All Audits'}
            </h2>
              <p className="mt-1 text-sm text-slate-500">
                Search audits and filter them by status.
              </p>
            </div>

            <div className="text-sm text-slate-500">
              {filteredAudits.length}{' '}
              {filteredAudits.length === 1 ? 'audit' : 'audits'}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <label className="relative block flex-1">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Search by audit, location, cluster, or auditor..."
                aria-label="Search audits"
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span className="whitespace-nowrap font-medium">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => updateStatusFilter(event.target.value)}
                aria-label="Filter audits by status"
                className="min-w-40 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'ALL' ? 'All statuses' : formatStatus(option)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {paginatedAudits.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="font-semibold text-slate-700">No audits found</p>
            <p className="mt-1 text-sm text-slate-500">
              Try changing the search text or status filter.
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {paginatedAudits.map((audit, index) => {
                const auditKey =
                  audit.audit_id || `${audit.template_name || 'audit'}-${index}`;
                const criticalFailures = Number(audit.critical_failures) || 0;

                return (
                  <article
                    key={auditKey}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold text-slate-900">
                          {audit.template_name || audit.audit_id || 'Untitled audit'}
                        </h3>
                        <StatusBadge value={audit.status} />
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        {audit.location_name || audit.location_id || 'No location'}
                        {' · '}
                        {audit.auditor_name ||
                          audit.auditor_email ||
                          'Unknown auditor'}
                        {audit.cluster_name ? ` · ${audit.cluster_name}` : ''}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {audit.submitted_at
                          ? 'Submitted'
                          : audit.created_at
                            ? 'Created'
                            : 'Date'}{' '}
                        {formatDate(getAuditDate(audit))}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-4 text-sm">
                      <span
                        className={
                          criticalFailures > 0
                            ? 'font-semibold text-rose-600'
                            : 'text-slate-500'
                        }
                      >
                        {criticalFailures} critical
                      </span>
                      <span className="font-medium text-slate-700">
                        Score {audit.score_percent ?? 0}%
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Showing {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, filteredAudits.length)} of{' '}
                {filteredAudits.length}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                <span className="min-w-20 text-center text-sm text-slate-600">
                  Page {currentPage} of {pageCount}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setPage((current) => Math.min(pageCount, current + 1))
                  }
                  disabled={currentPage === pageCount}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ value }) {
  const normalized = status(value);

  const colorClass = ['APPROVED', 'CLOSED', 'COMPLETED'].includes(normalized)
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
    : ['REJECTED', 'CANCELLED', 'OVERDUE'].includes(normalized)
      ? 'bg-rose-50 text-rose-700 ring-rose-600/20'
      : ['SUBMITTED', 'PENDING_VERIFICATION'].includes(normalized)
        ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
        : 'bg-slate-100 text-slate-700 ring-slate-500/20';

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${colorClass}`}
    >
      {formatStatus(value)}
    </span>
  );
}

function Metric({ icon: Icon, label, value, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    violet: 'bg-violet-50 text-violet-700',
    cyan: 'bg-cyan-50 text-cyan-700'
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span
          className={`inline-flex rounded-lg p-2 ${colorClasses[color] || colorClasses.blue}`}
        >
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
