import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  AlertTriangle,
  PlayCircle,
  RefreshCw,
  CheckCircle2,
  ClipboardList
} from 'lucide-react';

const STATUS_STYLES = {
  SCHEDULED: {
    label: 'Scheduled',
    className: 'bg-slate-100 text-slate-600 border-slate-200'
  },
  NOT_STARTED: {
    label: 'Not Started',
    className: 'bg-slate-100 text-slate-600 border-slate-200'
  },
  IN_PROGRESS: {
    label: 'In Progress',
    className: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  SUBMITTED: {
    label: 'Submitted',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PRIORITY_ORDER = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3
};

const PRIORITY_FILTERS = [
  { value: 'ALL', label: 'All priorities' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' }
];

const getAuditName = (assignment, templates = []) => {
  const template = templates.find(
    (item) =>
      String(item.template_id) === String(assignment.template_id) ||
      String(item.template_code) === String(assignment.template_id)
  );

  const storedName = String(assignment.template_name || '').trim();
  const isGeneratedTemplateId = storedName.startsWith('TMP-');

  return (
    template?.template_name ||
    (!isGeneratedTemplateId && storedName) ||
    assignment.template_id ||
    'Untitled Audit'
  );
};

function toISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const stringValue = String(value).trim();
  const dateOnlyMatch = stringValue.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (dateOnlyMatch) {
    return new Date(
      Number(dateOnlyMatch[1]),
      Number(dateOnlyMatch[2]) - 1,
      Number(dateOnlyMatch[3])
    );
  }

  const date = new Date(stringValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

/*
 * Schedules in this project store their scheduled assignment date in run_date.
 * The other fields are fallbacks for assignment records with a different shape.
 */
function getAssignDate(assignment) {
  return (
    assignment.run_date ||
    assignment.start_date ||
    assignment.assigned_at ||
    assignment.assigned_date ||
    assignment.created_at
  );
}

function fmtDate(value) {
  const date = parseDate(value);
  if (!date) return 'N/A';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function tone(assignment) {
  const status = String(
    assignment.status || assignment.audit_status || 'NOT_STARTED'
  ).toUpperCase();

  if (['SUBMITTED', 'COMPLETED', 'APPROVED'].includes(status)) {
    return 'bg-emerald-600/90 text-white';
  }

  if (['IN_PROGRESS', 'DRAFT'].includes(status)) {
    return 'bg-amber-500 text-white';
  }

  if (assignment.is_overdue) {
    return 'bg-rose-600 text-white';
  }

  return 'bg-blue-600/90 text-white';
}

export default function AuditorCalendar({
  assignments = [],
  templates = [],
  currentUser,
  onStartAudit,
  onRefreshData
}) {
  const now = new Date();
  const todayISO = toISODate(now);

  const [cursor, setCursor] = useState({
    y: now.getFullYear(),
    m: now.getMonth()
  });
  const [selected, setSelected] = useState(todayISO);
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  const filteredAssignments = useMemo(() => {
    if (priorityFilter === 'ALL') return assignments;

    return assignments.filter(
      (assignment) =>
        String(assignment.priority || 'MEDIUM').toUpperCase() ===
        priorityFilter
    );
  }, [assignments, priorityFilter]);

  const byDay = useMemo(() => {
    const assignmentsByDay = {};

    filteredAssignments.forEach((assignment) => {
      const date = parseDate(getAssignDate(assignment));
      if (!date) return;

      const dateKey = toISODate(date);
      (assignmentsByDay[dateKey] = assignmentsByDay[dateKey] || []).push(
        assignment
      );
    });

    Object.values(assignmentsByDay).forEach((dayAssignments) => {
      dayAssignments.sort((a, b) => {
        const aPriority =
          PRIORITY_ORDER[
            String(a.priority || 'MEDIUM').toUpperCase()
          ] ?? 4;
        const bPriority =
          PRIORITY_ORDER[
            String(b.priority || 'MEDIUM').toUpperCase()
          ] ?? 4;

        return aPriority - bPriority;
      });
    });

    return assignmentsByDay;
  }, [filteredAssignments]);

  const cells = useMemo(() => {
    const firstDay = new Date(cursor.y, cursor.m, 1);
    const gridStart = new Date(firstDay);
    gridStart.setDate(1 - firstDay.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);

      return {
        date,
        iso: toISODate(date),
        inMonth: date.getMonth() === cursor.m
      };
    });
  }, [cursor]);

  const monthEvents = cells
    .filter((cell) => cell.inMonth)
    .flatMap((cell) => byDay[cell.iso] || []);

  const monthOverdue = monthEvents.filter(
    (event) =>
      event.is_overdue &&
      !['SUBMITTED', 'COMPLETED', 'APPROVED'].includes(
        String(event.status || event.audit_status || '').toUpperCase()
      )
  ).length;

  const monthDone = monthEvents.filter((event) =>
    ['SUBMITTED', 'COMPLETED', 'APPROVED'].includes(
      String(event.status || event.audit_status || '').toUpperCase()
    )
  ).length;

  const selectedEvents = byDay[selected] || [];

  const templateFor = (assignment) =>
    templates.find(
      (template) =>
        String(template.template_id) === String(assignment.template_id) ||
        String(template.template_code) === String(assignment.template_id)
    );

  const shiftMonth = (delta) => {
    setCursor((current) => {
      const date = new Date(current.y, current.m + delta, 1);
      return { y: date.getFullYear(), m: date.getMonth() };
    });
  };

  const goToday = () => {
    setCursor({ y: now.getFullYear(), m: now.getMonth() });
    setSelected(todayISO);
  };

  return (
    <div className="space-y-6 font-sans text-slate-800">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
            Inspection Schedule
          </span>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            My Calendar
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Assigned inspections for{' '}
            {currentUser?.name || currentUser?.email}, shown by assignment date.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefreshData}
          className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Reload Assignments
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            label: 'Assigned This Month',
            value: monthEvents.length,
            valueClass: 'text-slate-900',
            icon: CalendarDays
          },
          {
            label: 'Overdue',
            value: monthOverdue,
            valueClass: 'text-rose-600',
            icon: AlertTriangle
          },
          {
            label: 'Completed',
            value: monthDone,
            valueClass: 'text-emerald-600',
            icon: CheckCircle2
          }
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {stat.label}
              </div>
              <stat.icon className="h-3.5 w-3.5 text-slate-300" />
            </div>
            <div className={`mt-1 text-2xl font-black ${stat.valueClass}`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-black tracking-tight text-slate-900">
              {MONTHS[cursor.m]} {cursor.y}
            </h2>
            <button
              type="button"
              onClick={goToday}
              className="cursor-pointer rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700 transition-all hover:bg-blue-100"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="cursor-pointer rounded-lg border border-slate-200 p-1.5 text-slate-600 transition-all hover:bg-slate-50"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="cursor-pointer rounded-lg border border-slate-200 p-1.5 text-slate-600 transition-all hover:bg-slate-50"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="py-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell) => {
            const events = byDay[cell.iso] || [];
            const isToday = cell.iso === todayISO;
            const isSelected = cell.iso === selected;

            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => setSelected(cell.iso)}
                className={`flex min-h-[86px] cursor-pointer flex-col gap-1 rounded-xl border p-1.5 text-left transition-all ${
                  cell.inMonth
                    ? 'border-slate-200/80 bg-white hover:border-blue-300 hover:bg-blue-50/40'
                    : 'border-slate-100 bg-slate-50/60'
                } ${isSelected ? 'border-blue-500 ring-2 ring-blue-500' : ''}`}
              >
                <div className="flex items-center justify-between">
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

                  {events.length > 0 && (
                    <span className="text-[9px] font-bold text-slate-400">
                      {events.length}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1 overflow-hidden">
                  {events.slice(0, 2).map((event) => (
                    <span
                      key={event.schedule_id || event.audit_id}
                      className={`truncate rounded-md px-1.5 py-0.5 text-[9px] font-bold leading-tight ${tone(event)}`}
                      title={getAuditName(event, templates)}
                    >
                      {getAuditName(event, templates)}
                    </span>
                  ))}

                  {events.length > 2 && (
                    <span className="px-1 text-[9px] font-bold text-slate-400">
                      +{events.length - 2} more
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3">
          {[
            { label: 'Pending', className: 'bg-blue-600/90' },
            { label: 'In Progress', className: 'bg-amber-500' },
            { label: 'Overdue', className: 'bg-rose-600' },
            { label: 'Submitted', className: 'bg-emerald-600/90' }
          ].map((item) => (
            <span
              key={item.label}
              className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"
            >
              <span className={`h-2.5 w-2.5 rounded-md ${item.className}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
            {selected === todayISO
              ? "Today's Inspections"
              : `Inspections — ${fmtDate(selected)}`}
          </h3>

          <div className="flex items-center gap-3">
            <label
              htmlFor="priority-filter"
              className="text-xs font-semibold text-slate-500"
            >
              Filter priority
            </label>
            <select
              id="priority-filter"
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {PRIORITY_FILTERS.map((priority) => (
                <option key={priority.value} value={priority.value}>
                  {priority.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-3 text-[11px] font-bold text-slate-500">
          {selectedEvents.length} scheduled
        </div>

        {selectedEvents.length === 0 ? (
          <div className="space-y-3 rounded-3xl border border-slate-200/80 bg-white p-12 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-slate-300" />
            <div className="text-sm font-bold text-slate-800">
              No Inspections This Day
            </div>
            <p className="mx-auto max-w-sm text-xs text-slate-400">
              Click a date on the calendar to see its assigned inspections.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedEvents.map((assignment) => {
              const status = String(
                assignment.status ||
                  assignment.audit_status ||
                  'NOT_STARTED'
              ).toUpperCase();
              const badge =
                STATUS_STYLES[status] || STATUS_STYLES.NOT_STARTED;
              const template = templateFor(assignment);
              const submitted = [
                'SUBMITTED',
                'COMPLETED',
                'APPROVED'
              ].includes(status);
              const inProgress = ['IN_PROGRESS', 'DRAFT'].includes(status);
              const noTemplate =
                !template || !(template.sections || []).length;
              const priority = String(
                assignment.priority || 'MEDIUM'
              ).toUpperCase();

              return (
                <div
                  key={assignment.schedule_id || assignment.audit_id}
                  className={`flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm transition-all lg:flex-row lg:items-center ${
                    assignment.is_overdue && !submitted
                      ? 'border-rose-200'
                      : 'border-slate-200/80'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase ${badge.className}`}
                      >
                        {badge.label}
                      </span>

                      <span
                        className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase ${
                          priority === 'CRITICAL'
                            ? 'border-rose-300 bg-rose-100 text-rose-800'
                            : priority === 'HIGH'
                              ? 'border-orange-200 bg-orange-50 text-orange-700'
                              : priority === 'MEDIUM'
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        {priority}
                      </span>

                      {assignment.is_overdue && !submitted && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-0.5 text-[9px] font-bold uppercase text-white">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Overdue
                        </span>
                      )}
                    </div>

                    <div className="truncate text-sm font-bold text-slate-900">
                      {getAuditName(assignment, templates)}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        {assignment.location_id || 'All Locations'}
                      </span>

                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        Assigned {fmtDate(getAssignDate(assignment))}
                      </span>

                      <span className="flex items-center gap-1.5">
                        <ClipboardList className="h-3.5 w-3.5 text-slate-400" />
                        {assignment.frequency || 'ONE_TIME'}
                      </span>

                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
                        {(template?.questions_count ??
                          assignment.questions_count) ||
                          0}{' '}
                        questions
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {noTemplate ? (
                      <span className="text-[10px] font-bold uppercase text-amber-600">
                        Checklist unavailable
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={submitted}
                        onClick={() =>
                          onStartAudit?.(assignment, template)
                        }
                        className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all ${
                          submitted
                            ? 'cursor-not-allowed bg-slate-400 opacity-60 shadow-none'
                            : inProgress
                              ? 'cursor-pointer bg-amber-600 shadow-amber-500/20 hover:bg-amber-700'
                              : 'cursor-pointer bg-blue-600 shadow-blue-500/20 hover:bg-blue-700'
                        }`}
                      >
                        <PlayCircle className="h-4 w-4" />
                        {submitted
                          ? 'Completed'
                          : inProgress
                            ? 'Resume Audit'
                            : 'Start Audit'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}