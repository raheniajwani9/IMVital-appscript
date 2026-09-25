import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Eye,
  Clock
} from 'lucide-react';

import { supabase } from '../supabaseClient';
import AuditReportModal from '../components/AuditReportModal';

const REVIEW_STYLES = {
  PENDING_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  RE_AUDIT_REQUESTED: 'bg-purple-50 text-purple-700 border-purple-200',
  CLOSED: 'bg-slate-100 text-slate-600 border-slate-200'
};

const ACTION_STYLES = {
  OPEN: 'bg-rose-50 text-rose-700 border-rose-200',
  ACCEPTED: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  PENDING_VERIFICATION: 'bg-purple-50 text-purple-700 border-purple-200',
  PENDING: 'bg-purple-50 text-purple-700 border-purple-200',
  VERIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  CLOSED: 'bg-slate-100 text-slate-600 border-slate-200'
};

const formatDate = (value) => {
  if (!value) return 'N/A';

  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

const normalizeStatus = (value) => {
  return String(value || '').trim().toUpperCase();
};

export default function AuditManagerView({ currentUser }) {
  const [audits, setAudits] = useState([]);
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [actions, setActions] = useState([]);
  const [actionHistory, setActionHistory] = useState([]);
  const [reviewHistory, setReviewHistory] = useState([]);

  const [reportAudit, setReportAudit] = useState(null);
  const [comment, setComment] = useState('');
  const [reAuditReason, setReAuditReason] = useState('');
  const [pendingDecision, setPendingDecision] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const reviewLocked = ['APPROVED', 'CLOSED'].includes(
    normalizeStatus(selectedAudit?.review_status)
  );

  const unresolvedActions = actions.filter((action) => {
    return !['VERIFIED', 'CLOSED'].includes(
      normalizeStatus(action.status)
    );
  });

  const loadAudits = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('audits')
      .select('*')
      .in('status', ['SUBMITTED', 'COMPLETED'])
      .order('submitted_at', { ascending: false });

    if (error) {
      setMessage(error.message);
      setAudits([]);
    } else {
      setAudits(data || []);
    }

    setLoading(false);
  };

  const loadAuditDetails = async (audit) => {
    setSelectedAudit(audit);
    setPendingDecision(null);
    setComment('');
    setReAuditReason('');
    setLoadingDetails(true);
    setMessage('');

    const [
      actionsResult,
      historyResult,
      reviewsResult
    ] = await Promise.all([
      supabase
        .from('actions')
        .select('*')
        .eq('audit_id', audit.audit_id)
        .order('created_at', { ascending: false }),

      supabase
        .from('action_history')
        .select('*')
        .eq('audit_id', audit.audit_id)
        .order('created_at', { ascending: false }),

      supabase
        .from('audit_manager_reviews')
        .select('*')
        .eq('audit_id', audit.audit_id)
        .order('created_at', { ascending: false })
    ]);

    if (actionsResult.error) {
      setMessage(actionsResult.error.message);
    }

    if (historyResult.error) {
      console.error('Action history error:', historyResult.error);
    }

    if (reviewsResult.error) {
      console.error('Review history error:', reviewsResult.error);
    }

    setActions(actionsResult.data || []);
    setActionHistory(historyResult.data || []);
    setReviewHistory(reviewsResult.data || []);
    setLoadingDetails(false);
  };

  useEffect(() => {
    loadAudits();
  }, []);

  useEffect(() => {
    if (!selectedAudit && audits.length > 0) {
      loadAuditDetails(audits[0]);
    }
  }, [audits, selectedAudit]);

  const filteredAudits = audits.filter((audit) => {
    const query = search.toLowerCase().trim();

    if (!query) return true;

    return [
      audit.audit_id,
      audit.template_name,
      audit.auditor_name,
      audit.auditor_email,
      audit.location_id,
      audit.review_status
    ]
      .map((value) => String(value || '').toLowerCase())
      .some((value) => value.includes(query));
  });

  const saveAuditReview = async (decision) => {
    if (!selectedAudit) return;

    if (reviewLocked) {
      setMessage('This audit is already approved or closed.');
      return;
    }

    if (decision === 'REJECT' && !comment.trim()) {
      setMessage('A manager comment is required when rejecting an audit.');
      return;
    }

    if (decision === 'REQUEST_REAUDIT' && !reAuditReason.trim()) {
      setMessage('A re-audit reason is required.');
      return;
    }

    if (decision === 'APPROVE' && unresolvedActions.length > 0) {
      setMessage(
        'All corrective actions must be verified before approving this audit.'
      );
      return;
    }

    setSaving(true);
    setMessage('');

    const reviewStatus = {
      APPROVE: 'APPROVED',
      REJECT: 'REJECTED',
      REQUEST_REAUDIT: 'RE_AUDIT_REQUESTED'
    }[decision];

    const { error: reviewError } = await supabase
      .from('audit_manager_reviews')
      .insert({
        audit_id: selectedAudit.audit_id,
        manager_email: currentUser.email,
        decision,
        comment: decision === 'REJECT' ? comment.trim() : ''
      });

    if (reviewError) {
      setSaving(false);
      setMessage(reviewError.message);
      return;
    }

    const { error: auditError } = await supabase
      .from('audits')
      .update({
        review_status: reviewStatus,
        reviewed_by: currentUser.email,
        reviewed_at: new Date().toISOString(),
        review_comment: decision === 'REJECT' ? comment.trim() : '',
        re_audit_required: decision === 'REQUEST_REAUDIT'
      })
      .eq('audit_id', selectedAudit.audit_id);

    if (auditError) {
      setSaving(false);
      setMessage(auditError.message);
      return;
    }

    if (decision === 'REQUEST_REAUDIT') {
      const { error: requestError } = await supabase
        .from('re_audit_requests')
        .insert({
          audit_id: selectedAudit.audit_id,
          requested_by_email: currentUser.email,
          reason: reAuditReason.trim(),
          status: 'OPEN'
        });

      if (requestError) {
        setSaving(false);
        setMessage(requestError.message);
        return;
      }
    }

    const updatedAudit = {
      ...selectedAudit,
      review_status: reviewStatus
    };

    setSelectedAudit(updatedAudit);
    setComment('');
    setReAuditReason('');
    setPendingDecision(null);
    setSaving(false);
    setMessage(`Audit marked as ${reviewStatus}.`);

    await loadAudits();
    await loadAuditDetails(updatedAudit);
  };

  const updateActionStatus = async (action, nextStatus) => {
    const actionOwner = String(action.owner_email || '').toLowerCase();
    const managerEmail = String(currentUser.email || '').toLowerCase();

    if (
      nextStatus === 'VERIFIED' &&
      actionOwner &&
      actionOwner === managerEmail
    ) {
      setMessage('You cannot verify your own action.');
      return;
    }

    if (
      nextStatus === 'REJECTED' &&
      !comment.trim()
    ) {
      setMessage('A rejection comment is required.');
      return;
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
        currentUser.user_id || currentUser.email;
      updatePayload.verified_at = new Date().toISOString();
      updatePayload.verification_comment = comment.trim() || null;
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

    const { error: historyError } = await supabase
      .from('action_history')
      .insert({
        action_id: action.action_id,
        audit_id: action.audit_id,
        old_status: action.status,
        new_status: nextStatus,
        changed_by: currentUser.user_id || currentUser.email,
        changed_by_email: currentUser.email,
        comment: comment.trim() || null,
        created_at: new Date().toISOString()
      });

    if (historyError) {
      console.error('Action history insert error:', historyError);
    }

    setComment('');
    setSaving(false);
    setMessage(`Action marked as ${nextStatus}.`);

    await loadAuditDetails(selectedAudit);
  };

  if (loading) {
    return (
      <div className="p-8 text-sm font-semibold text-slate-500">
        Loading audits for review...
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            Manager Review
          </span>

          <h1 className="text-2xl font-bold text-slate-900">
            Audit Reviews
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Review audit answers, images, evidence, actions, and closure status.
          </p>
        </div>

        {message && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-700">
            {message}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="space-y-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search audits..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
            />

            {filteredAudits.map((audit) => {
              const reviewStatus =
                audit.review_status || 'PENDING_REVIEW';

              return (
                <button
                  key={audit.audit_id}
                  onClick={() => loadAuditDetails(audit)}
                  className={`w-full rounded-xl border bg-white p-4 text-left ${
                    selectedAudit?.audit_id === audit.audit_id
                      ? 'border-blue-500 ring-2 ring-blue-100'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate font-bold text-slate-900">
                      {audit.template_name || audit.audit_id}
                    </span>

                    <span
                      className={`rounded-md border px-2 py-1 text-[10px] font-bold ${
                        REVIEW_STYLES[reviewStatus] ||
                        REVIEW_STYLES.PENDING_REVIEW
                      }`}
                    >
                      {reviewStatus}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    Auditor:{' '}
                    {audit.auditor_name ||
                      audit.auditor_email ||
                      'Unknown'}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    POD: {audit.location_id || 'N/A'}
                  </p>

                  <p className="mt-1 text-[10px] font-semibold text-slate-400">
                    Score: {audit.score_percent ?? 0}% · Submitted:{' '}
                    {formatDate(audit.submitted_at)}
                  </p>
                </button>
              );
            })}
          </div>

          {selectedAudit && (
            <div className="space-y-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {selectedAudit.template_name ||
                        selectedAudit.audit_id}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Audit ID: {selectedAudit.audit_id}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Auditor:{' '}
                      {selectedAudit.auditor_name ||
                        selectedAudit.auditor_email ||
                        'Unknown'}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      POD / Location:{' '}
                      {selectedAudit.location_id || 'N/A'}
                    </p>
                  </div>

                  <ShieldCheck className="h-6 w-6 text-blue-600" />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Metric
                    label="Score"
                    value={`${selectedAudit.score_percent ?? 0}%`}
                  />

                  <Metric
                    label="Failures"
                    value={selectedAudit.failure_count ?? 0}
                  />

                  <Metric
                    label="Critical"
                    value={selectedAudit.critical_failures ?? 0}
                  />

                  <Metric
                    label="Unresolved Actions"
                    value={unresolvedActions.length}
                  />
                </div>

                <button
                  onClick={() =>
                    setReportAudit({
                      auditId: selectedAudit.audit_id,
                      templateName: selectedAudit.template_name
                    })
                  }
                  className="mt-5 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
                >
                  <Eye className="h-4 w-4" />
                  View Questions and Evidence
                </button>

                {pendingDecision === 'REJECT' && (
                  <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4">
                    <label className="block text-sm font-bold text-rose-900">
                      Manager comment <span className="text-rose-600">*</span>
                      <textarea
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        placeholder="Explain why this audit is being rejected."
                        className="mt-2 min-h-24 w-full rounded-xl border border-rose-200 bg-white p-3 text-sm font-normal text-slate-800 outline-none focus:border-rose-400"
                      />
                    </label>
                  </div>
                )}

                {pendingDecision === 'REQUEST_REAUDIT' && (
                  <div className="mt-5 rounded-xl border border-purple-200 bg-purple-50 p-4">
                    <label className="block text-sm font-bold text-purple-900">
                      Reason for re-audit <span className="text-purple-600">*</span>
                      <textarea
                        value={reAuditReason}
                        onChange={(event) => setReAuditReason(event.target.value)}
                        placeholder="Explain why this audit needs to be repeated."
                        className="mt-2 min-h-24 w-full rounded-xl border border-purple-200 bg-white p-3 text-sm font-normal text-slate-800 outline-none focus:border-purple-400"
                      />
                    </label>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    disabled={
                      saving ||
                      reviewLocked ||
                      unresolvedActions.length > 0
                    }
                    onClick={() => saveAuditReview('APPROVE')}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </button>

                  <button
                    disabled={saving || reviewLocked}
                    onClick={() => {
                      setMessage('');
                      setComment('');
                      setPendingDecision('REJECT');
                    }}
                    className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </button>

                  <button
                    disabled={saving || reviewLocked}
                    onClick={() => {
                      setMessage('');
                      setReAuditReason('');
                      setPendingDecision('REQUEST_REAUDIT');
                    }}
                    className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Request Re-audit
                  </button>

                </div>

                {pendingDecision && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      disabled={saving}
                      onClick={() => saveAuditReview(pendingDecision)}
                      className={`rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${pendingDecision === 'REJECT' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                    >
                      {saving
                        ? 'Submitting…'
                        : pendingDecision === 'REJECT'
                          ? 'Confirm rejection'
                          : 'Submit re-audit request'}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setPendingDecision(null);
                        setComment('');
                        setReAuditReason('');
                        setMessage('');
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </section>

              <ActionReviewPanel
                actions={actions}
                history={actionHistory}
                currentUser={currentUser}
                saving={saving}
                onUpdateAction={updateActionStatus}
              />

              <ReviewHistory reviews={reviewHistory} />
            </div>
          )}

          {loadingDetails && (
            <div className="rounded-xl bg-white p-6 text-sm text-slate-500">
              Loading audit details...
            </div>
          )}
        </div>
      </div>

      {reportAudit && (
        <AuditReportModal
          auditId={reportAudit.auditId}
          templateName={reportAudit.templateName}
          onClose={() => setReportAudit(null)}
        />
      )}
    </>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-[10px] font-bold uppercase text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-xl font-black text-slate-900">
        {value}
      </div>
    </div>
  );
}

function ActionReviewPanel({
  actions,
  history,
  currentUser,
  saving,
  onUpdateAction
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="mb-4 font-bold text-slate-900">
        Actions and Previous Instances
      </h3>

      {actions.length === 0 && (
        <p className="text-sm text-slate-500">
          No corrective actions linked to this audit.
        </p>
      )}

      {actions.map((action) => {
        const actionStatus = normalizeStatus(action.status);

        const previousInstances = history.filter(
          (item) => item.action_id === action.action_id
        );

        const canVerify =
          ['PENDING_VERIFICATION', 'PENDING'].includes(actionStatus) &&
          String(action.owner_email || '').toLowerCase() !==
            String(currentUser.email || '').toLowerCase();

        return (
          <div
            key={action.action_id}
            className="mb-4 rounded-xl border border-slate-200 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-bold text-slate-800">
                  {action.title ||
                    action.action_title ||
                    'Corrective Action'}
                </h4>

                <p className="mt-1 text-xs text-slate-500">
                  {action.description ||
                    action.action_description ||
                    'No description provided.'}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Owner:{' '}
                  {action.owner_email ||
                    action.owner_user_id ||
                    'Unassigned'}
                </p>

                {action.finding && (
                  <p className="mt-1 text-xs text-slate-500">
                    Finding: {action.finding}
                  </p>
                )}

                {action.risk_category && (
                  <p className="mt-1 text-xs text-slate-500">
                    Risk: {action.risk_category}
                  </p>
                )}
              </div>

              <span
                className={`rounded-md border px-2 py-1 text-[10px] font-bold ${
                  ACTION_STYLES[actionStatus] ||
                  'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {actionStatus || 'UNKNOWN'}
              </span>
            </div>

            {canVerify && (
              <div className="mt-4 flex gap-2">
                <button
                  disabled={saving}
                  onClick={() =>
                    onUpdateAction(action, 'VERIFIED')
                  }
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Verify Evidence
                </button>

                <button
                  disabled={saving}
                  onClick={() =>
                    onUpdateAction(action, 'REJECTED')
                  }
                  className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reject Evidence
                </button>
              </div>
            )}

            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="mb-2 text-xs font-bold text-slate-700">
                Previous Instances
              </p>

              {previousInstances.length === 0 && (
                <p className="text-xs text-slate-400">
                  No previous status changes.
                </p>
              )}

              {previousInstances.map((item) => (
                <div
                  key={item.history_id}
                  className="mb-2 rounded-lg bg-slate-50 p-2"
                >
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                    <Clock className="h-3 w-3" />
                    {item.old_status || 'NEW'} → {item.new_status}
                  </div>

                  <div className="mt-1 text-[10px] text-slate-400">
                    {item.changed_by_email || 'System'} ·{' '}
                    {formatDate(item.created_at)}
                  </div>

                  {item.comment && (
                    <p className="mt-1 text-xs text-slate-600">
                      {item.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function ReviewHistory({ reviews }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 font-bold text-slate-900">
        Manager Review History
      </h3>

      {reviews.length === 0 && (
        <p className="text-sm text-slate-500">
          No manager decisions recorded yet.
        </p>
      )}

      {reviews.map((review) => (
        <div
          key={review.review_id}
          className="mb-3 rounded-xl bg-slate-50 p-3"
        >
          <div className="text-xs font-bold text-slate-800">
            {review.decision}
          </div>

          <p className="mt-1 text-xs text-slate-600">
            {review.comment || 'No comment'}
          </p>

          <p className="mt-2 text-[10px] text-slate-400">
            {review.manager_email} · {formatDate(review.created_at)}
          </p>
        </div>
      ))}
    </section>
  );
}
