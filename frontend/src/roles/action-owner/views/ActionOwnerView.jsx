import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  Eye,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
  UserRound
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
  'CLOSED'
];

const PRIORITY_OPTIONS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const STATUS_STYLES = {
  OPEN: 'border-rose-200 bg-rose-50 text-rose-700',
  ACCEPTED: 'border-blue-200 bg-blue-50 text-blue-700',
  IN_PROGRESS: 'border-amber-200 bg-amber-50 text-amber-700',
  PENDING_VERIFICATION: 'border-violet-200 bg-violet-50 text-violet-700',
  REJECTED: 'border-rose-200 bg-rose-50 text-rose-700',
  VERIFIED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CLOSED: 'border-slate-200 bg-slate-100 text-slate-600'
};

const normalize = (value) => String(value || '').trim().toUpperCase();

const firstValue = (...values) =>
  values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ''
  );

const formatDate = (value, includeTime = false) => {
  if (!value) return 'Not available';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';

  return date.toLocaleString(
    undefined,
    includeTime
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { dateStyle: 'medium' }
  );
};

const isClosed = (status) =>
  ['VERIFIED', 'CLOSED'].includes(normalize(status));

export default function ActionOwnerView({
  currentUser,
  statusScope = 'ALL',
  viewTitle = 'My Actions',
  onRefresh
}) {
  const [actions, setActions] = useState([]);
  const [historyByAction, setHistoryByAction] = useState({});
  const [drafts, setDrafts] = useState({});
  const [selectedActionId, setSelectedActionId] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');

  const showMessage = (text, type = 'info') => {
    setMessage(text);
    setMessageType(type);
  };

  const loadActions = useCallback(async () => {
    const email = String(currentUser?.email || '').trim();

    if (!email) {
      setActions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage('');

    const { data: actionRows, error: actionError } = await supabase
      .from('actions')
      .select('*')
      .ilike('owner_email', email)
      .order('created_at', { ascending: false });

    if (actionError) {
      showMessage(actionError.message, 'error');
      setActions([]);
      setLoading(false);
      return;
    }

    const rows = actionRows || [];
    const auditIds = [
      ...new Set(rows.map((action) => action.audit_id).filter(Boolean))
    ];

    let audits = [];
    let schedules = [];

    if (auditIds.length > 0) {
      const { data: auditRows, error: auditsError } = await supabase
        .from('audits')
        .select('*')
        .in('audit_id', auditIds);

      if (auditsError) {
        console.error('Could not load audit details:', auditsError);
      } else {
        audits = auditRows || [];
      }

      const scheduleIds = [
        ...new Set(audits.map((audit) => audit.schedule_id).filter(Boolean))
      ];

      if (scheduleIds.length > 0) {
        const { data: scheduleRows, error: schedulesError } = await supabase
          .from('schedules')
          .select('*')
          .in('schedule_id', scheduleIds);

        if (schedulesError) {
          console.error('Could not load schedule details:', schedulesError);
        } else {
          schedules = scheduleRows || [];
        }
      }
    }

    const { data: locationRows, error: locationsError } = await supabase
      .from('locations')
      .select('*');

    if (locationsError) {
      console.error('Could not load locations:', locationsError);
    }

    const locations = locationRows || [];

    const enrichedRows = rows.map((action) => {
      const audit =
        audits.find(
          (item) => String(item.audit_id) === String(action.audit_id)
        ) || {};

      const schedule =
        schedules.find(
          (item) => String(item.schedule_id) === String(audit.schedule_id)
        ) || {};

      const locationId = firstValue(
        action.location_id,
        audit.location_id,
        audit.pod_id,
        schedule.location_id,
        schedule.pod_id
      );

      const location =
        locations.find((item) => {
          const possibleIds = [
            item.pod_id,
            item.location_id,
            item['Location ID'],
            item['Store Name']
          ].filter(Boolean);

          return possibleIds.some(
            (value) =>
              String(value).toLowerCase() ===
              String(locationId || '').toLowerCase()
          );
        }) || {};

      return {
        ...action,
        audit_details: audit,
        schedule_details: schedule,
        location_details: location,

        display_audit_name: firstValue(
          audit.audit_name,
          audit.template_name,
          audit.form_name,
          schedule.audit_name,
          schedule.template_name,
          schedule.form_name,
          'Audit'
        ),

        display_auditor: firstValue(
          audit.auditor_name,
          schedule.assigned_auditor_name,
          schedule.auditor_name,
          audit.auditor_email,
          schedule.assigned_auditor_email,
          'Not available'
        ),

        display_auditor_email: firstValue(
          audit.auditor_email,
          schedule.assigned_auditor_email,
          schedule.auditor_email,
          ''
        ),

        display_cluster: firstValue(
          action.cluster,
          audit.cluster,
          schedule.cluster,
          location.Cluster,
          location.cluster,
          'Not available'
        ),

        display_pod: firstValue(
          action.pod_name,
          action.pod_id,
          audit.pod_name,
          audit.pod_id,
          schedule.pod_name,
          schedule.pod_id,
          location['Pod Name'],
          location.pod_name,
          location['Store Name'],
          location.pod_id,
          'Not available'
        ),

        display_location: firstValue(
          action.location_name,
          audit.location_name,
          schedule.location_name,
          location['Store Name'],
          location.location_name,
          location.name,
          location['Location ID'],
          locationId,
          'Not available'
        ),

        display_action_date: firstValue(
          audit.audit_date,
          audit.started_at,
          audit.start_date,
          audit.submitted_at,
          audit.created_at,
          schedule.audit_date,
          schedule.start_date,
          action.created_at
        )
      };
    });

    setActions(enrichedRows);

    setDrafts((previous) => {
      const next = { ...previous };

      enrichedRows.forEach((action) => {
        const savedEvidence = Array.isArray(action.closure_evidence_uris)
          ? action.closure_evidence_uris
          : [];

        next[action.action_id] = {
          comment: previous[action.action_id]?.comment || '',
          evidence: previous[action.action_id]?.evidence || savedEvidence
        };
      });

      return next;
    });

    if (rows.length > 0) {
      const actionIds = rows.map((action) => action.action_id);

      const { data: historyRows, error: historyError } = await supabase
        .from('action_history')
        .select('*')
        .in('action_id', actionIds)
        .order('created_at', { ascending: false });

      if (historyError) {
        console.error('Could not load action history:', historyError);
      } else {
        const grouped = {};

        (historyRows || []).forEach((item) => {
          grouped[item.action_id] ||= [];
          grouped[item.action_id].push(item);
        });

        setHistoryByAction(grouped);
      }
    } else {
      setHistoryByAction({});
    }

    setLoading(false);
  }, [currentUser?.email]);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  const patchDraft = (actionId, patch) => {
    setDrafts((previous) => ({
      ...previous,
      [actionId]: {
        comment: '',
        evidence: [],
        ...previous[actionId],
        ...patch
      }
    }));
  };

  const uploadEvidence = async (action, file) => {
    if (!file) return;

    setUploadingId(action.action_id);
    setMessage('');

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `actions/${action.action_id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('evidence')
      .upload(path, file, { upsert: false });

    if (uploadError) {
      showMessage(`Evidence upload failed: ${uploadError.message}`, 'error');
      setUploadingId(null);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('evidence')
      .getPublicUrl(path);

    const existing = drafts[action.action_id]?.evidence || [];

    patchDraft(action.action_id, {
      evidence: [
        ...existing,
        {
          file_name: file.name,
          file_url: urlData.publicUrl,
          storage_path: path,
          uploaded_at: new Date().toISOString()
        }
      ]
    });

    showMessage('Evidence uploaded. Save or request verification to attach it.');
    setUploadingId(null);
  };

  const saveAction = async (action, nextStatus) => {
    const draft = drafts[action.action_id] || {
      comment: '',
      evidence: []
    };

    const now = new Date().toISOString();

    const currentStatus = normalize(action.status);
    const allowedNextStatus = {
      OPEN: ['ACCEPTED'],
      REJECTED: ['ACCEPTED'],
      ACCEPTED: ['IN_PROGRESS'],
      IN_PROGRESS: ['PENDING_VERIFICATION']
    };

    if (!allowedNextStatus[currentStatus]?.includes(nextStatus)) {
      showMessage('Complete the action steps in order before moving to the next status.', 'error');
      return;
    }

    if (['IN_PROGRESS', 'PENDING_VERIFICATION'].includes(nextStatus) && !(draft.comment || '').trim()) {
      showMessage('Add a comment before continuing this action.', 'error');
      return;
    }

    if (nextStatus === 'PENDING_VERIFICATION' && !(draft.evidence || []).length) {
      showMessage(
        'Upload at least one evidence file before requesting verification.',
        'error'
      );
      return;
    }

    setSavingId(action.action_id);
    setMessage('');

    const payload = {
      status: nextStatus,
      closure_evidence_uris: draft.evidence || [],
      updated_at: now
    };

    if (nextStatus === 'ACCEPTED' && !action.accepted_at) {
      payload.accepted_at = now;
    }

    if (nextStatus === 'PENDING_VERIFICATION') {
      payload.verification_requested_at = now;
      payload.verification_status = 'PENDING';
    }

    const { error: updateError } = await supabase
      .from('actions')
      .update(payload)
      .eq('action_id', action.action_id);

    if (updateError) {
      showMessage(updateError.message, 'error');
      setSavingId(null);
      return;
    }

    const { error: historyError } = await supabase
      .from('action_history')
      .insert({
        action_id: action.action_id,
        audit_id: action.audit_id,
        old_status: action.status || null,
        new_status: nextStatus,
        changed_by: currentUser?.user_id || currentUser?.email,
        changed_by_email: currentUser?.email || null,
        comment: (draft.comment || '').trim() || null,
        created_at: now
      });

    setSavingId(null);

    if (historyError) {
      showMessage(
        `Action updated, but history could not be saved: ${historyError.message}`,
        'error'
      );
    } else if (nextStatus === 'PENDING_VERIFICATION') {
      showMessage(
        'Verification requested. The action is now in the Audit Manager’s Action Center.'
      );
    } else {
      showMessage(`Action updated to ${nextStatus}.`);
    }

    patchDraft(action.action_id, { comment: '' });
    await loadActions();
  };

  const filteredActions = useMemo(() => {
    const query = search.trim().toLowerCase();
    const scopeValues = Array.isArray(statusScope) ? statusScope : [statusScope];
    const normalizedScope = scopeValues.map(normalize);

    return actions.filter((action) => {
      const matchesScope =
        normalizedScope.includes('ALL') ||
        normalizedScope.includes(normalize(action.status));

      const matchesStatus =
        statusFilter === 'ALL' || normalize(action.status) === statusFilter;

      const matchesPriority =
        priorityFilter === 'ALL' ||
        normalize(action.priority) === priorityFilter;

      const searchableText = [
        action.audit_id,
        action.display_audit_name,
        action.display_cluster,
        action.display_pod,
        action.display_location,
        action.display_auditor,
        action.display_auditor_email,
        action.title,
        action.action_title,
        action.finding,
        action.description,
        action.action_description
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      return (
        matchesScope &&
        matchesStatus &&
        matchesPriority &&
        (!query || searchableText.includes(query))
      );
    });
  }, [actions, search, statusFilter, priorityFilter, statusScope]);

  const summary = useMemo(
    () => ({
      total: actions.length,
      needsAction: actions.filter((item) =>
        ['OPEN', 'REJECTED'].includes(normalize(item.status))
      ).length,
      inProgress: actions.filter(
        (item) => normalize(item.status) === 'IN_PROGRESS'
      ).length,
      pendingVerification: actions.filter(
        (item) => normalize(item.status) === 'PENDING_VERIFICATION'
      ).length,
      completed: actions.filter((item) => isClosed(item.status)).length
    }),
    [actions]
  );

  const selectedAction = actions.find(
    (action) => action.action_id === selectedActionId
  );

  if (loading) {
    return (
      <div className="p-8 text-sm font-semibold text-slate-500">
        Loading your corrective actions…
      </div>
    );
  }

  if (selectedAction) {
    const draft = drafts[selectedAction.action_id] || {
      comment: '',
      evidence: selectedAction.closure_evidence_uris || []
    };

    return (
      <ActionOwnerDetailPage
        action={selectedAction}
        draft={draft}
        history={historyByAction[selectedAction.action_id] || []}
        saving={savingId === selectedAction.action_id}
        uploading={uploadingId === selectedAction.action_id}
        message={message}
        messageType={messageType}
        onBack={() => setSelectedActionId(null)}
        onPatchDraft={(patch) => patchDraft(selectedAction.action_id, patch)}
        onUploadEvidence={(file) => uploadEvidence(selectedAction, file)}
        onSave={(status) => saveAction(selectedAction, status)}
      />
    );
  }

  return (
    <div className="space-y-5">

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Action Owner</span>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">{viewTitle}</h1>
            <p className="mt-0.5 text-sm text-slate-500">Review assigned findings and move each action through verification.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh || loadActions}
          disabled={loading || savingId !== null}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh actions
        </button>
      </div>

      {message && <MessageBanner message={message} type={messageType} />}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Needs action" value={summary.needsAction} />
        <SummaryCard label="In progress" value={summary.inProgress} />
        <SummaryCard label="Pending verification" value={summary.pendingVerification} />
        <SummaryCard label="Completed" value={summary.completed} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_210px_180px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search audit, cluster, pod, auditor…"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status === 'ALL' ? 'All statuses' : status.replaceAll('_', ' ')}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          >
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority} value={priority}>
                {priority === 'ALL' ? 'All priorities' : priority}
              </option>
            ))}
          </select>

        </div>
      </section>

      {filteredActions.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <p className="mt-4 font-bold text-slate-800">No matching actions</p>
          <p className="mt-1 text-sm text-slate-500">
            Adjust the search or filters to find assigned actions.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-bold text-slate-900">Assigned actions</h2>
              <p className="mt-1 text-xs text-slate-500">
                {filteredActions.length} action{filteredActions.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="hidden text-xs text-slate-400 sm:block">
              Select a row to review action details
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-4">Audit ID</th>
                  <th className="px-5 py-4">Audit name</th>
                  <th className="px-5 py-4">Cluster</th>
                  <th className="px-5 py-4">Pod</th>
                  <th className="px-5 py-4">Location</th>
                  <th className="px-5 py-4">Audit date</th>
                  <th className="px-5 py-4">Auditor</th>
                  <th className="px-5 py-4">Priority</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredActions.map((action) => {
                  const status = normalize(action.status);

                  return (
                    <tr
                      key={action.action_id}
                      className="border-b border-slate-100 transition last:border-0 hover:bg-blue-50/40"
                    >
                      <td className="whitespace-nowrap px-5 py-5 font-mono text-xs text-slate-600">
                        {action.audit_id || 'Not available'}
                      </td>

                      <td className="max-w-[250px] px-5 py-5">
                        <div className="truncate font-semibold text-slate-900">
                          {action.display_audit_name || 'Audit'}
                        </div>
                      </td>

                      <td className="px-5 py-5 text-sm text-slate-700">
                        {action.display_cluster || 'Not available'}
                      </td>

                      <td className="px-5 py-5 text-sm text-slate-700">
                        {action.display_pod || 'Not available'}
                      </td>

                      <td className="px-5 py-5">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                          <span>{action.display_location || 'Not available'}</span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-5 py-5 text-sm text-slate-700">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
                          {formatDate(action.display_action_date)}
                        </div>
                      </td>

                      <td className="px-5 py-5">
                        <div className="flex items-start gap-2">
                          <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <div>
                            <div className="text-sm font-medium text-slate-700">
                              {action.display_auditor || 'Not available'}
                            </div>
                            {action.display_auditor_email && (
                              <div className="mt-1 text-xs text-slate-400">
                                {action.display_auditor_email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-5">
                        <PriorityBadge priority={action.priority} />
                      </td>

                      <td className="px-5 py-5">
                        <StatusBadge status={status} />
                      </td>

                      <td className="px-5 py-5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedActionId(action.action_id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionOwnerDetailPage({
  action,
  draft,
  history,
  saving,
  uploading,
  message,
  messageType,
  onBack,
  onPatchDraft,
  onUploadEvidence,
  onSave
}) {
  const status = normalize(action.status);
  const pending = status === 'PENDING_VERIFICATION';
  const terminal = isClosed(status);
  const evidence = draft.evidence || [];
  const steps = ['Accept action', 'Mark in progress', 'Request verification'];
  const activeStep = ['OPEN', 'REJECTED'].includes(status)
    ? 0
    : status === 'ACCEPTED'
      ? 1
      : status === 'IN_PROGRESS'
        ? 2
        : 3;

  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-xl px-1 py-2 text-sm font-semibold text-slate-600 transition hover:text-blue-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Actions
      </button>

      {message && <MessageBanner message={message} type={messageType} />}

      {pending && (
        <div className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm font-semibold text-violet-800">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          Verification requested. An Audit Manager will review this action and
          its evidence.
        </div>
      )}

      {action.rejection_comment && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <strong>Verifier feedback</strong>
          <p className="mt-1 whitespace-pre-wrap">{action.rejection_comment}</p>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Action workflow</p>
            <h1 className="mt-1 text-xl font-black text-slate-900">{action.title || action.action_title || action.finding || 'Corrective action'}</h1>
          </div>
          <StatusBadge status={status} />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {steps.map((step, index) => {
            const complete = activeStep > index;
            const current = activeStep === index;
            return (
              <div
                key={step}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  current
                    ? 'border-blue-200 bg-blue-50'
                    : complete
                      ? 'border-emerald-200 bg-emerald-50/70'
                      : 'border-slate-100 bg-slate-50'
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  current ? 'bg-blue-600 text-white' : complete ? 'bg-emerald-600 text-white' : 'bg-white text-slate-400'
                }`}>
                  {complete ? <Check className="h-4 w-4" /> : <span className="text-xs font-black">{index + 1}</span>}
                </span>
                <span className={`text-xs font-bold ${current ? 'text-blue-800' : complete ? 'text-emerald-800' : 'text-slate-500'}`}>
                  {step}
                  <span className="mt-0.5 block text-[10px] font-medium opacity-75">
                    {current ? 'Current step' : complete ? 'Completed' : 'Up next'}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <DetailPanel title="Audit information">
          <Detail label="Audit name" value={action.display_audit_name} />
          <Detail label="Auditor" value={action.display_auditor} />
          <Detail label="Auditor email" value={action.display_auditor_email} />
          <Detail label="Cluster" value={action.display_cluster} />
          <Detail label="Pod" value={action.display_pod} />
          <Detail label="Location" value={action.display_location} />
          <Detail
            label="Audit date"
            value={formatDate(action.display_action_date)}
          />
          <Detail label="Due date" value={formatDate(action.due_date)} />
        </DetailPanel>

        <DetailPanel title="Finding">
          <Detail label="Priority" value={action.priority} />
          <Detail label="Risk category" value={action.risk_category} />
          <Detail label="Finding" value={action.finding} />
          <Detail
            label="Action description"
            value={action.description || action.action_description}
          />
        </DetailPanel>
      </section>

      {evidence.length > 0 && (
        <DetailPanel title="Attached evidence">
          <div className="grid gap-2 sm:grid-cols-2">
            {evidence.map((item, index) => (
              <a
                key={item.storage_path || item.file_url || index}
                href={item.file_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-blue-700 transition hover:border-blue-200 hover:bg-blue-50"
              >
                {item.file_name || `Evidence ${index + 1}`}
              </a>
            ))}
          </div>
        </DetailPanel>
      )}

      {!terminal && !pending && (
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              {status === 'IN_PROGRESS' ? <ShieldCheck className="h-5 w-5" /> : <Check className="h-5 w-5" />}
            </span>
            <div>
            <h2 className="font-bold text-slate-900">{status === 'OPEN' || status === 'REJECTED' ? 'Accept this action' : status === 'ACCEPTED' ? 'Begin corrective work' : 'Submit work for verification'}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {status === 'OPEN' || status === 'REJECTED'
                ? 'Accept this action to begin work.'
                : status === 'ACCEPTED'
                  ? 'Add a required comment before marking this action in progress.'
                  : 'Add a required comment and evidence before requesting verification.'}
            </p>
            </div>
          </div>

          {['ACCEPTED', 'IN_PROGRESS'].includes(status) && <div className="grid gap-4">
            <label className="block text-sm font-semibold text-slate-700">
              Comment <span className="text-rose-600">Required</span>
              <textarea
                rows={4}
                value={draft.comment || ''}
                onChange={(event) =>
                  onPatchDraft({ comment: event.target.value })
                }
                required
                className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                placeholder={status === 'ACCEPTED' ? 'Explain how you will start addressing this action.' : 'Summarize the corrective work completed for the verifier.'}
              />
            </label>
          </div>}

          {status === 'IN_PROGRESS' && <>
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-800">Evidence <span className="text-rose-600">Required</span></p>
                <p className="mt-1 text-xs text-slate-500">Attach at least one file to support the verification request.</p>
              </div>
              <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition ${uploading ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading…' : 'Choose file'}
                <input
                  type="file"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(event) => {
                    onUploadEvidence(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </label>
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-600">
              {evidence.length ? `${evidence.length} file${evidence.length === 1 ? '' : 's'} attached` : 'No evidence attached yet'}
            </p>
          </div>
          </>}

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {['OPEN', 'REJECTED'].includes(status) && (
              <button
                type="button"
                disabled={saving || uploading}
                onClick={() => onSave('ACCEPTED')}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Accepting…' : 'Accept action'}
              </button>
            )}

            {status === 'ACCEPTED' && (
              <button
                type="button"
                disabled={saving || uploading || !(draft.comment || '').trim()}
                onClick={() => onSave('IN_PROGRESS')}
                className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-amber-600 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Mark in progress'}
              </button>
            )}

            {status === 'IN_PROGRESS' && <button
              type="button"
              disabled={saving || uploading || !(draft.comment || '').trim() || !evidence.length}
              onClick={() => onSave('PENDING_VERIFICATION')}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              {saving ? 'Submitting…' : 'Request verification'}
            </button>}
          </div>
        </section>
      )}

      <DetailPanel title="Previous status history">
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">
            No previous status changes recorded.
          </p>
        ) : (
          <div className="space-y-3">
            {history.map((item, index) => (
              <div
                key={item.history_id || `${item.created_at}-${index}`}
                className="rounded-xl border border-slate-100 bg-slate-50 p-4"
              >
                <p className="text-sm font-bold text-slate-800">
                  {item.old_status || 'NEW'} →{' '}
                  {String(item.new_status || '').replaceAll('_', ' ')}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.changed_by_email || 'System'} ·{' '}
                  {formatDate(item.created_at, true)}
                </p>
                {item.comment && (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
                    {item.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </DetailPanel>
    </main>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black text-slate-900">{value}</div>
    </div>
  );
}

function StatusBadge({ status, large = false }) {
  const normalized = normalize(status);

  return (
    <span
      className={`inline-flex whitespace-nowrap items-center rounded-lg border font-bold ${
        large ? 'px-4 py-2 text-sm' : 'px-3 py-2 text-xs'
      } ${
        STATUS_STYLES[normalized] ||
        'border-slate-200 bg-slate-100 text-slate-600'
      }`}
    >
      {normalized.replaceAll('_', ' ') || 'UNKNOWN'}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const value = normalize(priority) || '—';
  const style =
    value === 'CRITICAL' || value === 'HIGH'
      ? 'bg-rose-50 text-rose-700'
      : value === 'MEDIUM'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-slate-100 text-slate-600';

  return (
    <span className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${style}`}>
      {value}
    </span>
  );
}

function MessageBanner({ message, type }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
        type === 'error'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-blue-200 bg-blue-50 text-blue-700'
      }`}
    >
      {type === 'error' && (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}

function DetailPanel({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Detail({ label, value }) {
  return (
    <div className="mb-3 grid grid-cols-[130px_1fr] gap-3 text-sm last:mb-0">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="whitespace-pre-wrap break-words text-slate-800">
        {value || 'Not available'}
      </span>
    </div>
  );
}
