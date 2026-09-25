import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin, PlayCircle } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const PRIORITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const PRIORITY_OPTIONS = [
  { value: 'ALL', label: 'All priorities' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' }
];

/* date helpers — safe for "YYYY-MM-DD" strings */
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parse = (v) => {
  if (!v) return null;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const fmt = (v) => parse(v)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || 'N/A';

// Schedules use run_date as the assigned inspection date; due_date is the deadline.
const getAssignedDate = (assignment) =>
  assignment.run_date || assignment.start_date || assignment.created_at;

const getAuditName = (assignment, templates = [], template) => {
  const matchedTemplate = template || templates.find((t) =>
    String(t.template_id) === String(assignment.template_id) ||
    String(t.template_code) === String(assignment.template_id)
  );
  const storedName = String(assignment.template_name || '').trim();
  const isGeneratedTemplateId = storedName.startsWith('TMP-');

  return matchedTemplate?.template_name ||
    (!isGeneratedTemplateId && storedName) ||
    assignment.template_id ||
    'Untitled Audit';
};

/* chip color by status */
const chipTone = (a) => {
  const st = String(a.audit_status || '').toUpperCase();
  if (st === 'SUBMITTED' || st === 'COMPLETED' || st === 'APPROVED') return 'bg-emerald-600 text-white';
  if (st === 'IN_PROGRESS') return 'bg-amber-500 text-white';
  if (a.is_overdue) return 'bg-rose-600 text-white';
  return 'bg-blue-600 text-white';
};

export default function AuditorCalendarView({
  assignments = [],
  templates = [],
  currentUser,
  onStartAudit
}) {
  const now = new Date();
  const todayISO = toISO(now);
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState(todayISO);
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  const filteredAssignments = useMemo(() => {
    const filtered = assignments.filter((assignment) =>
      priorityFilter === 'ALL' ||
      String(assignment.priority || 'MEDIUM').toUpperCase() === priorityFilter
    );

    return filtered.sort((a, b) => {
      const aPriority = PRIORITY_ORDER[String(a.priority || 'MEDIUM').toUpperCase()] ?? 4;
      const bPriority = PRIORITY_ORDER[String(b.priority || 'MEDIUM').toUpperCase()] ?? 4;
      return aPriority - bPriority;
    });
  }, [assignments, priorityFilter]);

  /* Group assignments by their assigned inspection date (run_date), not deadline. */
  const byDay = useMemo(() => {
    const map = {};
    filteredAssignments.forEach((a) => {
      const d = parse(getAssignedDate(a));
      if (d) {
        const key = toISO(d);
        (map[key] = map[key] || []).push(a);
      }
    });
    return map;
  }, [filteredAssignments]);

  /* 6-week grid starting Sunday */
  const cells = useMemo(() => {
    const start = new Date(ym.y, ym.m, 1 - new Date(ym.y, ym.m, 1).getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { d, iso: toISO(d), inMonth: d.getMonth() === ym.m };
    });
  }, [ym]);

  /* month summary */
  const summary = useMemo(() => {
    let assigned = 0, overdue = 0, done = 0;
    cells.filter((c) => c.inMonth).forEach((c) => {
      (byDay[c.iso] || []).forEach((a) => {
        assigned += 1;
        const st = String(a.audit_status || '').toUpperCase();
        if (['SUBMITTED', 'COMPLETED', 'APPROVED'].includes(st)) done += 1;
        else if (a.is_overdue) overdue += 1;
      });
    });
    return { assigned, overdue, done };
  }, [cells, byDay]);

  const events = byDay[selected] || [];
  const templateFor = (a) =>
    templates.find((t) => String(t.template_id) === String(a.template_id) || String(t.template_code) === String(a.template_id));

  const move = (n) =>
    setYm(({ y, m }) => {
      const d = new Date(y, m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const goToday = () => {
    setYm({ y: now.getFullYear(), m: now.getMonth() });
    setSelected(todayISO);
  };

  return (
    <div className="space-y-4 font-sans text-slate-800">
      {/* Compact header */}
      <div className="flex items-end justify-between gap-1">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Calendar</h1>
          <p className="text-sm font-medium text-slate-500 mt-0.5">
            {summary.assigned} assigned this month · {summary.overdue} overdue · {summary.done} completed
          </p>
        </div>
      </div>

      <div className="max-w-sm">
        <label htmlFor="calendar-priority-filter" className="block text-xs font-semibold text-slate-500 mb-1.5">
          Filter inspections by priority
        </label>
        <select
          id="calendar-priority-filter"
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {/* Side-by-side layout: calendar + day details */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr] lg:items-start">
        {/* Calendar card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6 min-w-0">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              {MONTHS[ym.m]} <span className="font-medium text-slate-400">{ym.y}</span>
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => move(-1)}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => move(1)}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const evts = byDay[cell.iso] || [];
              const isToday = cell.iso === todayISO;
              const isSelected = cell.iso === selected;
              return (
                <button
                  key={cell.iso}
                  onClick={() => setSelected(cell.iso)}
                  className={`min-h-[76px] sm:min-h-[90px] border rounded-lg p-1.5 text-left flex flex-col gap-0.5 transition-colors cursor-pointer
                    ${cell.inMonth ? 'bg-white border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/40' : 'bg-slate-50/60 border-slate-100'}
                    ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
                >
                  <span
                    className={`text-[11px] font-semibold w-5 h-5 flex items-center justify-center rounded-full
                      ${isToday ? 'bg-blue-600 text-white' : cell.inMonth ? 'text-slate-600' : 'text-slate-300'}`}
                  >
                    {cell.d.getDate()}
                  </span>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {evts.slice(0, 2).map((e) => (
                      <span
                        key={e.schedule_id || e.audit_id}
                        title={getAuditName(e, templates)}
                        className={`truncate px-1 py-px rounded text-[9px] font-medium leading-snug ${chipTone(e)}`}
                      >
                        {getAuditName(e, templates)}
                      </span>
                    ))}
                    {evts.length > 2 && (
                      <span className="text-[9px] font-medium text-slate-400 px-1">+{evts.length - 2}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 pt-2 border-t border-slate-100">
            {[
              ['Due', 'bg-blue-600'],
              ['In Progress', 'bg-amber-500'],
              ['Overdue', 'bg-rose-600'],
              ['Submitted', 'bg-emerald-600']
            ].map(([label, cls]) => (
              <span key={label} className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
                <span className={`w-2 h-2 rounded ${cls}`} /> {label}
              </span>
            ))}
          </div>
        </div>

        {/* Day details panel */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6 min-w-0 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 tracking-wide">
              {selected === todayISO ? 'Today' : fmt(selected)}
            </h3>
            <span className="text-[10px] font-medium text-slate-400">{events.length} scheduled</span>
          </div>

          {events.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs font-semibold text-slate-600">No inspections</p>
              <p className="text-[10px] font-normal text-slate-400 mt-1">Click a date to view its schedule.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {events.map((a) => {
                const st = String(a.audit_status || 'NOT_STARTED').toUpperCase();
                const submitted = ['SUBMITTED', 'COMPLETED', 'APPROVED'].includes(st);
                const inProgress = st === 'IN_PROGRESS';
                const tpl = templateFor(a);
                const auditName = getAuditName(a, templates, tpl);

                return (
                  <div
                    key={a.schedule_id || a.audit_id}
                    className={`rounded-xl border p-3 space-y-2
                      ${a.is_overdue && !submitted ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200/80'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 leading-snug">{auditName}</p>
                        <p className="flex items-center gap-1 text-[10px] font-medium text-slate-500 mt-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{a.location_id || 'All Locations'}</span>
                        </p>
                      </div>
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold border
                          ${submitted ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : inProgress ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : a.is_overdue ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-slate-100 text-slate-600 border-slate-200'}`}
                      >
                        {submitted ? 'Submitted' : inProgress ? 'In Progress' : a.is_overdue ? 'Overdue' : 'Not Started'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-medium text-slate-400">
                        {a.priority || 'MEDIUM'} · {a.frequency || 'ONE_TIME'} · Assigned {fmt(getAssignedDate(a))}
                      </span>
                      {!tpl || !(tpl.sections || []).length ? (
                        <span className="text-[9px] font-semibold text-amber-600">Checklist unavailable</span>
                      ) : (
                        <button
                          disabled={submitted}
                          onClick={() => onStartAudit && onStartAudit(a, tpl)}
                          className={`flex items-center gap-1.5 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors
                            ${submitted ? 'bg-slate-400 opacity-60 cursor-not-allowed'
                            : inProgress ? 'bg-amber-600 hover:bg-amber-700 cursor-pointer'
                            : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'}`}
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          {submitted ? 'Completed' : inProgress ? 'Resume' : 'Start'}
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
    </div>
  );
}
