import React, { useMemo } from 'react';

const normalize = (value) => String(value || '').trim().toUpperCase();

const CLOSED_STATUSES = ['VERIFIED', 'CLOSED'];
const PENDING_STATUSES = ['OPEN', 'REJECTED', 'ACCEPTED', 'PENDING'];

const isOverdue = (action) => {
  if (!action.due_date || CLOSED_STATUSES.includes(normalize(action.status))) {
    return false;
  }

  const dueDate = new Date(action.due_date);
  return !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < Date.now();
};

export default function ActionOwnerDashboardView({
  actions = [],
  onOpenActions
}) {
  const summary = useMemo(
    () => ({
      pending: actions.filter((action) =>
        PENDING_STATUSES.includes(normalize(action.status))
      ).length,
      inProgress: actions.filter(
        (action) => normalize(action.status) === 'IN_PROGRESS'
      ).length,
      awaitingVerification: actions.filter(
        (action) => normalize(action.status) === 'PENDING_VERIFICATION'
      ).length,
      overdue: actions.filter(isOverdue).length
    }),
    [actions]
  );

  const attentionActions = actions
    .filter(
      (action) =>
        PENDING_STATUSES.includes(normalize(action.status)) ||
        isOverdue(action)
    )
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Pending" value={summary.pending} />
        <Metric label="In progress" value={summary.inProgress} />
        <Metric
          label="Awaiting verification"
          value={summary.awaitingVerification}
        />
        <Metric label="Overdue" value={summary.overdue} danger />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h2 className="font-bold text-slate-900">Needs your attention</h2>
            <p className="mt-1 text-sm text-slate-500">
              Pending, returned, or overdue actions.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenActions}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            View all actions
          </button>
        </div>

        {attentionActions.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">
            Nothing needs your attention right now.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {attentionActions.map((action) => (
              <div
                key={action.action_id}
                className="flex flex-col justify-between gap-2 p-5 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {action.display_audit_name || 'Audit'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {action.title || action.action_title || 'Corrective action'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isOverdue(action) && (
                    <span className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700">
                      OVERDUE
                    </span>
                  )}
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700">
                    {normalize(action.status).replaceAll('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, danger = false }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-black ${
          danger ? 'text-rose-600' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}