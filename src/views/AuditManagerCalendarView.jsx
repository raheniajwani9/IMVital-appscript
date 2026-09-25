import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  UserRound,
  Clock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const formatStatus = (value) => String(value || 'UNKNOWN')
  .replaceAll('_', ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const toISO = (date) => {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
};

const parseDate = (value) => {
  if (!value) return null;

  const match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value) => {
  const date = parseDate(value);

  if (!date) return 'N/A';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const formatDateTime = (value) => {
  if (!value) return 'N/A';

  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

const getPerformedDate = (audit) => {
  return (
    audit.submitted_at ||
    audit.completed_at ||
    audit.started_at ||
    audit.created_at
  );
};

const getStatus = (audit) => {
  return String(
    audit.review_status ||
    audit.audit_status ||
    audit.status ||
    'SUBMITTED'
  ).toUpperCase();
};

const getStatusClass = (audit) => {
  const status = getStatus(audit);

  if (['APPROVED', 'VERIFIED', 'CLOSED'].includes(status)) {
    return 'bg-emerald-600 text-white';
  }

  if (
    ['REJECTED', 'RE_AUDIT_REQUESTED'].includes(status)
  ) {
    return 'bg-rose-600 text-white';
  }

  if (
    ['PENDING_REVIEW', 'SUBMITTED', 'IN_PROGRESS'].includes(status)
  ) {
    return 'bg-amber-500 text-white';
  }

  return 'bg-blue-600 text-white';
};

export default function AuditManagerCalendarView({
  audits = [],
  currentUser,
  onRefresh
}) {
  const now = new Date();

  const todayISO = toISO(now);

  const [cursor, setCursor] = useState({
    year: now.getFullYear(),
    month: now.getMonth()
  });

  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [statusFilter, setStatusFilter] = useState('ALL');

  const statusOptions = useMemo(() => {
    const statuses = [...new Set(audits.map(getStatus))].sort();
    return ['ALL', ...statuses];
  }, [audits]);

  const filteredAudits = useMemo(() => {
    if (statusFilter === 'ALL') return audits;
    return audits.filter((audit) => getStatus(audit) === statusFilter);
  }, [audits, statusFilter]);

  const byDay = useMemo(() => {
  const result = {};

  filteredAudits.forEach((audit) => {
    const date = parseDate(getPerformedDate(audit));
    if (!date) return;
    const key = toISO(date);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(audit);
  });

  return result;
}, [filteredAudits]);

  const cells = useMemo(() => {
    const firstDay = new Date(
      cursor.year,
      cursor.month,
      1
    );

    const start = new Date(firstDay);

    start.setDate(
      1 - firstDay.getDay()
    );

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);

      date.setDate(
        start.getDate() + index
      );

      return {
        date,
        iso: toISO(date),
        inMonth: date.getMonth() === cursor.month
      };
    });
  }, [cursor]);

  const selectedAudits = byDay[selectedDate] || [];

  const moveMonth = (amount) => {
    setCursor((previous) => {
      const date = new Date(
        previous.year,
        previous.month + amount,
        1
      );

      return {
        year: date.getFullYear(),
        month: date.getMonth()
      };
    });
  };

  const goToday = () => {
    setCursor({
      year: now.getFullYear(),
      month: now.getMonth()
    });

    setSelectedDate(todayISO);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">

        <button
          onClick={onRefresh}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700"
        >
          Refresh Calendar
        </button>

        
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter calendar by audit status"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'ALL' ? 'All statuses' : formatStatus(option)}
                  </option>
                ))}
              </select>
            </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900">
                {MONTHS[cursor.month]} {cursor.year}
              </h2>

              <button
                onClick={goToday}
                className="rounded-lg bg-blue-50 px-3 py-1 text-[10px] font-bold text-blue-700"
              >
                Today
              </button>
            </div>


            <div className="flex gap-1">
              <button
                onClick={() => moveMonth(-1)}
                className="rounded-lg border border-slate-200 p-2 text-slate-600"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                onClick={() => moveMonth(1)}
                className="rounded-lg border border-slate-200 p-2 text-slate-600"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-1 text-center text-[10px] font-bold uppercase text-slate-400"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const cellAudits = byDay[cell.iso] || [];
              const isToday = cell.iso === todayISO;
              const isSelected = cell.iso === selectedDate;

              return (
                <button
                  key={cell.iso}
                  onClick={() => setSelectedDate(cell.iso)}
                  className={`min-h-[90px] rounded-xl border p-1.5 text-left ${
                    cell.inMonth
                      ? 'border-slate-200 bg-white hover:border-blue-300'
                      : 'border-slate-100 bg-slate-50'
                  } ${
                    isSelected
                      ? 'ring-2 ring-blue-500'
                      : ''
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                      isToday
                        ? 'bg-blue-600 text-white'
                        : cell.inMonth
                          ? 'text-slate-700'
                          : 'text-slate-300'
                    }`}
                  >
                    {cell.date.getDate()}
                  </span>

                  <div className="mt-1 space-y-1 overflow-hidden">
                    {cellAudits.slice(0, 2).map((audit) => (
                      <div
                        key={audit.audit_id}
                        className={`truncate rounded-md px-1 py-0.5 text-[9px] font-bold ${getStatusClass(audit)}`}
                        title={`${audit.template_name} - ${audit.auditor_name}`}
                      >
                        {audit.template_name}
                      </div>
                    ))}

                    {cellAudits.length > 2 && (
                      <div className="px-1 text-[9px] font-bold text-slate-400">
                        +{cellAudits.length - 2} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {selectedDate === todayISO
                  ? 'Today'
                  : formatDate(selectedDate)}
              </h3>

              <p className="mt-1 text-[10px] font-semibold text-slate-400">
                {selectedAudits.length} audit(s)
              </p>
            </div>

            <CalendarDays className="h-5 w-5 text-blue-600" />
          </div>

          {selectedAudits.length === 0 && (
            <div className="py-10 text-center">
              <p className="text-sm font-bold text-slate-600">
                No audits on this date.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {selectedAudits.map((audit) => (
              <div
                key={audit.audit_id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {audit.template_name || audit.audit_id}
                    </h4>

                    <p className="mt-1 text-[10px] text-slate-400">
                      Audit ID: {audit.audit_id}
                    </p>
                  </div>

                  <span
                    className={`rounded-md px-2 py-1 text-[9px] font-bold ${getStatusClass(audit)}`}
                  >
                    {getStatus(audit)}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-xs font-semibold text-slate-600">
                  <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-slate-400" />
                    <span>
                      Auditor: {audit.auditor_name || 'Unknown'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span>
                      POD / Location: {audit.location_id || 'N/A'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span>
                      Due: {formatDate(audit.due_date)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-slate-400" />
                    <span>
                      Submitted: {formatDateTime(audit.submitted_at)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-[9px] font-bold uppercase text-slate-400">
                      Score
                    </div>

                    <div className="mt-1 text-lg font-black text-slate-900">
                      {audit.score_percent ?? 0}%
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-[9px] font-bold uppercase text-slate-400">
                      Critical Failures
                    </div>

                    <div className="mt-1 flex items-center gap-1 text-lg font-black text-rose-600">
                      {audit.critical_failures ?? 0}

                      {Number(audit.critical_failures) > 0 && (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
