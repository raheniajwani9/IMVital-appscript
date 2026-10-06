import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  AlertTriangle,
  CalendarDays,
  MapPin,
  UserRound,
  ClipboardCheck,
  Clock3,
  ShieldCheck
} from 'lucide-react';

import { supabase } from '../../../shared/lib/supabaseClient';

const STATUS_OPTIONS = [
  'ALL',
  'OPEN',
  'ACCEPTED',
  'IN_PROGRESS',
  'PENDING_VERIFICATION',
  'REJECTED',
  'VERIFIED',
];

const PRIORITY_OPTIONS = [
  'ALL',
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW'
];

const STATUS_STYLES = {
  OPEN: 'bg-rose-50 text-rose-700 border-rose-200',
  ACCEPTED: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  PENDING_VERIFICATION: 'bg-purple-50 text-purple-700 border-purple-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  VERIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const normalize = (value) => {
  return String(value || '').trim().toUpperCase();
};

const formatDate = (value) => {
  if (!value) return 'No due date';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const isOverdue = (action) => {
  if (!action.due_date) return false;

  return new Date(action.due_date).getTime() < Date.now();
};

export default function ActionCenterView({ currentUser }) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [search, setSearch] = useState('');
  // Open directly on owner-submitted requests so incoming work is immediately visible.
  const [statusFilter, setStatusFilter] = useState('PENDING_VERIFICATION');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  const loadActions = async () => {
    setLoading(true);
    setMessage('');

    const { data, error } = await supabase
      .from('actions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setMessage(error.message);
      setActions([]);
    } else {
      const rows = data || [];
      const actionIds = rows.map((action) => action.action_id).filter(Boolean);
      let historyRows = [];

      if (actionIds.length) {
        const { data: history, error: historyError } = await supabase
          .from('action_history')
          .select('action_id, new_status, comment, created_at')
          .in('action_id', actionIds)
          .order('created_at', { ascending: false });

        if (historyError) {
          console.error('Could not load action comments:', historyError);
        } else {
          historyRows = history || [];
        }
      }

      const ownerCommentByAction = new Map();
      historyRows.forEach((entry) => {
        if (
          normalize(entry.new_status) === 'PENDING_VERIFICATION' &&
          !ownerCommentByAction.has(entry.action_id)
        ) {
          ownerCommentByAction.set(entry.action_id, entry.comment || '');
        }
      });

      setActions(rows.map((action) => ({
        ...action,
        owner_comment: ownerCommentByAction.get(action.action_id) || ''
      })));
    }

    setLoading(false);
  };

  useEffect(() => {
    loadActions();
  }, []);

  const filteredActions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return actions.filter((action) => {
      const status = normalize(action.status);
      const priority = normalize(action.priority);

      const matchesStatus =
        statusFilter === 'ALL' || status === statusFilter;

      const matchesPriority =
        priorityFilter === 'ALL' || priority === priorityFilter;

      const searchableText = [
        action.action_id,
        action.audit_id,
        action.title,
        action.action_title,
        action.description,
        action.action_description,
        action.owner_email,
        action.location_id,
        action.risk_category,
        action.finding
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      const matchesSearch =
        !query || searchableText.includes(query);

      return matchesStatus && matchesPriority && matchesSearch;
    });
  }, [actions, search, statusFilter, priorityFilter]);

  const updateAction = async (action, nextStatus) => {
    const ownerEmail = String(action.owner_email || '').toLowerCase();
    const managerEmail = String(currentUser?.email || '').toLowerCase();

    if (
      nextStatus === 'VERIFIED' &&
      ownerEmail &&
      ownerEmail === managerEmail
    ) {
      setMessage('You cannot verify your own action.');
      return;
    }

    let comment = '';

    if (nextStatus === 'REJECTED') {
      comment = window.prompt('Enter rejection comment:') || '';

      if (!comment.trim()) {
        setMessage('A rejection comment is required.');
        return;
      }
    }

    setSaving(true);
    setMessage('');

    const updatePayload = {
      status: nextStatus,
      updated_at: new Date().toISOString()
    };

    if (nextStatus === 'VERIFIED') {
      updatePayload.verification_status = 'VERIFIED';
      updatePayload.verified_by =
        currentUser?.user_id || currentUser?.email;
      updatePayload.verified_at = new Date().toISOString();
      updatePayload.verification_comment = null;
      updatePayload.rejection_comment = null;
      updatePayload.closed_at = new Date().toISOString();
    }

    if (nextStatus === 'REJECTED') {
      updatePayload.verification_status = 'REJECTED';
      updatePayload.verification_comment = comment.trim();
      updatePayload.rejection_comment = comment.trim();
      updatePayload.verified_by = null;
      updatePayload.verified_at = null;
      updatePayload.closed_at = null;
    }

    const { error } = await supabase
      .from('actions')
      .update(updatePayload)
      .eq('action_id', action.action_id);

    if (error) {
      setSaving(false);
      setMessage(error.message);
      return;
    }

    setSaving(false);
    setMessage(`Action marked as ${nextStatus}.`);

    await loadActions();
  };

  const summary = useMemo(() => {
    return {
      total: actions.length,
      open: actions.filter((action) =>
        ['OPEN', 'ACCEPTED', 'IN_PROGRESS'].includes(
          normalize(action.status)
        )
      ).length,
      pendingVerification: actions.filter(
        (action) =>
          normalize(action.status) === 'PENDING_VERIFICATION'
      ).length,
      overdue: actions.filter(isOverdue).length,
      verified: actions.filter((action) =>
        ['VERIFIED'].includes(
          normalize(action.status)
        )
      ).length
    };
  }, [actions]);

  if (loading) {
    return (
      <div className="p-8 text-sm font-semibold text-slate-500">
        Loading corrective actions...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
            <ClipboardCheck className="h-6 w-6" />
          </span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Audit Manager</span>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Action Center</h1>
            <p className="mt-0.5 text-sm text-slate-500">Review owner-submitted evidence and verify corrective actions.</p>
          </div>
        </div>

        <button
          onClick={loadActions}
          disabled={loading || saving}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {message && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-700">
          {message}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Total" value={summary.total} />
        <SummaryCard label="Open" value={summary.open} />
        <SummaryCard
          label="Pending Verification"
          value={summary.pendingVerification}
        />
        <SummaryCard
          label="Overdue"
          value={summary.overdue}
          danger={summary.overdue > 0}
        />
        <SummaryCard label="Verified" value={summary.verified} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_180px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search actions..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status === 'ALL' ? 'All statuses' : status}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          >
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority} value={priority}>
                {priority === 'ALL' ? 'All priorities' : priority}
              </option>
            ))}
          </select>
        </div>
      </section>

        <section className="space-y-3">
        {filteredActions.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <p className="text-sm font-semibold text-slate-500">
              No corrective actions found.
            </p>
          </div>
        )}

        {filteredActions.map((action) => {
          const status = normalize(action.status);
          const overdue = isOverdue(action);
          const isSelfOwned =
            String(action.owner_email || '').trim().toLowerCase() ===
            String(currentUser?.email || '').trim().toLowerCase();
          const isVerificationRequest =
            ['PENDING_VERIFICATION', 'PENDING'].includes(status);
          const hasOwnerComment = Boolean(
            String(action.verification_comment || action.owner_comment || '').trim()
          );
          const evidenceFiles = Array.isArray(action.closure_evidence_uris)
            ? action.closure_evidence_uris
            : [];

          const canVerify =
            isVerificationRequest && !isSelfOwned;

          return (
            <article
              key={action.action_id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md sm:p-6"
            >
              <div className="flex flex-col justify-between gap-4 lg:flex-row">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-slate-900">
                      {action.title ||
                        action.action_title ||
                        'Corrective Action'}
                    </h2>

                    <span
                      className={`rounded-md border px-2 py-1 text-[10px] font-bold ${
                        STATUS_STYLES[status] ||
                        'border-slate-200 bg-slate-100 text-slate-600'
                      }`}
                    >
                      {status || 'UNKNOWN'}
                    </span>

                    {action.priority && (
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                        {normalize(action.priority)}
                      </span>
                    )}

                    {overdue && (
                      <span className="flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700">
                        <AlertTriangle className="h-3 w-3" />
                        OVERDUE
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-sm text-slate-600">
                    {action.description ||
                      action.action_description ||
                      'No description provided.'}
                  </p>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    <InfoItem label="Audit" value={action.audit_id || 'N/A'} />
                    <InfoItem label="Owner" value={action.owner_email || action.owner_user_id || 'Unassigned'} icon={UserRound} />
                    <InfoItem label="Location" value={action.location_id || 'N/A'} icon={MapPin} />
                    <InfoItem label="Risk" value={action.risk_category || 'General'} />
                    <InfoItem label="Due date" value={formatDate(action.due_date)} icon={CalendarDays} />
                    <InfoItem label="Created" value={formatDate(action.created_at)} icon={Clock3} />
                  </div>

                  {action.finding && (
                    <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                      <strong>Finding:</strong> {action.finding}
                    </div>
                  )}

                  {status === 'PENDING_VERIFICATION' && (
                    <div className="mt-4 space-y-4 rounded-2xl border border-violet-200 bg-violet-50/70 p-4 sm:p-5">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm"><ShieldCheck className="h-5 w-5" /></span>
                        <div className="text-xs font-bold text-violet-900">
                        Owner verification request
                        {action.verification_requested_at && (
                          <span className="mt-1 block font-medium text-violet-700">
                            {formatDate(action.verification_requested_at)}
                          </span>
                        )}
                        </div>
                      </div>

                      <div className="text-xs text-slate-700">
                        <strong>Owner comment:</strong>
                        <p className="mt-1 whitespace-pre-wrap">{action.verification_comment || action.owner_comment || 'No comment provided.'}</p>
                      </div>

                      <div className="text-xs text-slate-700">
                        <strong>Submitted evidence:</strong>
                        {Array.isArray(action.closure_evidence_uris) && action.closure_evidence_uris.length > 0 ? (
                          <ul className="mt-1 space-y-1">
                            {action.closure_evidence_uris.map((item, index) => (
                              <li key={item.storage_path || item.file_url || index}>
                                <a
                                  href={item.file_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-semibold text-blue-700 underline"
                                >
                                  {item.file_name || `Evidence ${index + 1}`}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1">No evidence attached.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {action.rejection_comment && (
                    <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
                      <strong>Rejection comment:</strong>{' '}
                      {action.rejection_comment}
                    </div>
                  )}
                </div>

                  <div className="flex shrink-0 flex-wrap items-start gap-2 lg:w-48 lg:flex-col lg:items-stretch">
                  {isVerificationRequest && isSelfOwned && (
                    <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-800">
                      <strong>Independent review required.</strong>
                      <p className="mt-1">
                        You are listed as this action’s owner. Sign in with a different Audit Manager account to verify it.
                      </p>
                    </div>
                  )}

                  {canVerify && (
                    <>
                      {hasOwnerComment && evidenceFiles.length > 0 ? (
                        <button
                          disabled={saving}
                          onClick={() => updateAction(action, 'VERIFIED')}
                          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Verify
                        </button>
                      ) : (
                        <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-800">
                          <strong>Submission is incomplete.</strong>
                          <p className="mt-1">
                            The owner must provide a comment and evidence before verification.
                          </p>
                        </div>
                      )}

                      <button
                        disabled={saving}
                        onClick={() =>
                          updateAction(action, 'REJECTED')
                        }
                        className="flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    </>
                  )}

                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function SummaryCard({ label, value, danger = false }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </div>

      <div
        className={`mt-2 text-2xl font-black ${
          danger ? 'text-rose-600' : 'text-slate-900'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function InfoItem({ label, value, icon: Icon }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className="mt-1 truncate text-xs font-semibold text-slate-700" title={String(value)}>{value}</div>
    </div>
  );
}
