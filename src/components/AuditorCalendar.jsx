import React, { useMemo, useState } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, MapPin, Clock,
  AlertTriangle, PlayCircle, RefreshCw, CheckCircle2, ClipboardList
} from 'lucide-react';

/* Status chip styles — matches the rest of IM VITALS */
const STATUS_STYLES = {
  SCHEDULED:    { label: 'Scheduled',   className: 'bg-slate-100 text-slate-600 border-slate-200' },
  NOT_STARTED:  { label: 'Not Started', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  IN_PROGRESS:  { label: 'In Progress', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  SUBMITTED:    { label: 'Submitted',   className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/* Local-safe date helpers (avoids UTC off-by-one on "YYYY-MM-DD" strings) */
function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(v) {
  const d = parseDate(v);
  if (!d) return 'N/A';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* Chip color on the grid, by assignment state */
function tone(a) {
  const st = String(a.status || a.audit_status || 'NOT_STARTED').toUpperCase();
  if (['SUBMITTED', 'COMPLETED', 'APPROVED'].includes(st)) return 'bg-emerald-600/90 text-white';
  if (['IN_PROGRESS', 'DRAFT'].includes(st)) return 'bg-amber-500 text-white';
  if (a.is_overdue) return 'bg-rose-600 text-white';
  return 'bg-blue-600/90 text-white';
}

export default function AuditorCalendar({
  assignments = [],
  templates = [],
  currentUser,
  onStartAudit,
  onRefreshData,
}) {
  const now = new Date();
  const todayISO = toISODate(now);
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState(todayISO);

  /* ISO date -> assignments due that day */
  const byDay = useMemo(() => {
    const map = {};
    assignments.forEach(a => {
      const d = parseDate(a.due_date || a.next_run_date || a.start_date);
      if (!d) return;
      const key = toISODate(d);
      (map[key] = map[key] || []).push(a);
    });
    return map;
  }, [assignments]);

  /* 6-week grid starting on Sunday */
  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { date: d, iso: toISODate(d), inMonth: d.getMonth() === cursor.m };
    });
  }, [cursor]);

  const monthEvents = cells.filter(c => c.inMonth).flatMap(c => byDay[c.iso] || []);
  const monthOverdue = monthEvents.filter(e => e.is_overdue && String(e.status || e.audit_status) !== 'SUBMITTED').length;
  const monthDone = monthEvents.filter(e => ['SUBMITTED', 'COMPLETED', 'APPROVED'].includes(String(e.status || e.audit_status).toUpperCase())).length;

  const selectedEvents = byDay[selected] || [];

  const templateFor = (a) => (templates || []).find(t =>
    String(t.template_id) === String(a.template_id) || String(t.template_code) === String(a.template_id)
  );

  const shiftMonth = (delta) => setCursor(c => {
    const d = new Date(c.y, c.m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const goToday = () => {
    setCursor({ y: now.getFullYear(), m: now.getMonth() });
    setSelected(todayISO);
  };

  return (
    <div className="space-y-6 font-sans text-slate-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-blue-600 tracking-wider uppercase">Inspection Schedule</span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 tracking-tight">My Calendar</h1>
          <p className="text-sm text-slate-500 mt-1">
            Assigned inspections for {currentUser?.name || currentUser?.email}, plotted by due date.
          </p>
        </div>
        <button
          onClick={onRefreshData}
          className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" /> Reload Assignments
        </button>
      </div>

      {/* Month stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Due This Month', value: monthEvents.length, tone: 'text-slate-900', icon: CalendarDays },
          { label: 'Overdue', value: monthOverdue, tone: 'text-rose-600', icon: AlertTriangle },
          { label: 'Completed', value: monthDone, tone: 'text-emerald-600', icon: CheckCircle2 },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</div>
              <s.icon className="w-3.5 h-3.5 text-slate-300" />
            </div>
            <div className={`text-2xl font-black mt-1 ${s.tone}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Calendar card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              {MONTHS[cursor.m]} {cursor.y}
            </h2>
            <button
              onClick={goToday}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-all cursor-pointer"
            >
              Today
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => shiftMonth(-1)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => shiftMonth(1)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map(cell => {
            const evts = byDay[cell.iso] || [];
            const isToday = cell.iso === todayISO;
            const isSelected = cell.iso === selected;
            return (
              <button
                key={cell.iso}
                onClick={() => setSelected(cell.iso)}
                className={`min-h-[86px] border rounded-xl p-1.5 text-left flex flex-col gap-1 transition-all cursor-pointer
                  ${cell.inMonth
                    ? 'bg-white border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/40'
                    : 'bg-slate-50/60 border-slate-100'}
                  ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-full
                    ${isToday ? 'bg-blue-600 text-white' : cell.inMonth ? 'text-slate-700' : 'text-slate-300'}`}>
                    {cell.date.getDate()}
                  </span>
                  {evts.length > 0 && (
                    <span className="text-[9px] font-bold text-slate-400">{evts.length}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1 overflow-hidden">
                  {evts.slice(0, 2).map(e => (
                    <span
                      key={e.schedule_id || e.audit_id}
                      className={`truncate px-1.5 py-0.5 rounded-md text-[9px] font-bold leading-tight ${tone(e)}`}
                      title={e.template_name || e.template_id}
                    >
                      {e.template_name || e.template_id}
                    </span>
                  ))}
                  {evts.length > 2 && (
                    <span className="text-[9px] font-bold text-slate-400 px-1">+{evts.length - 2} more</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 pt-3 border-t border-slate-100">
          {[
            { label: 'Pending', cls: 'bg-blue-600/90' },
            { label: 'In Progress', cls: 'bg-amber-500' },
            { label: 'Overdue', cls: 'bg-rose-600' },
            { label: 'Submitted', cls: 'bg-emerald-600/90' },
          ].map(l => (
            <span key={l.label} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
              <span className={`w-2.5 h-2.5 rounded-md ${l.cls}`} /> {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* Selected day panel */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
            {selected === todayISO ? "Today's Inspections" : `Inspections — ${fmtDate(selected)}`}
          </h3>
          <span className="text-[11px] font-bold text-slate-500">
            {selectedEvents.length} scheduled
          </span>
        </div>

        {selectedEvents.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center space-y-3">
            <CalendarDays className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-800">No Inspections This Day</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Click any date on the calendar to see what's scheduled, or switch months with the arrows.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedEvents.map(a => {
              const st = String(a.status || a.audit_status || 'NOT_STARTED').toUpperCase();
              const badge = STATUS_STYLES[st] || STATUS_STYLES.NOT_STARTED;
              const tpl = templateFor(a);
              const submitted = ['SUBMITTED', 'COMPLETED', 'APPROVED'].includes(st);
              const inProgress = ['IN_PROGRESS', 'DRAFT'].includes(st);
              const noTemplate = !tpl || !(tpl.sections || []).length;

              return (
                <div
                  key={a.schedule_id || a.audit_id}
                  className={`bg-white rounded-2xl border shadow-sm p-5 flex flex-col lg:flex-row lg:items-center gap-4 transition-all
                    ${a.is_overdue && !submitted ? 'border-rose-200' : 'border-slate-200/80'}`}
                >
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase ${badge.className}`}>
                        {badge.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase
                        ${a.priority === 'CRITICAL' || a.priority === 'HIGH'
                          ? 'bg-rose-50 text-rose-600 border border-rose-200'
                          : 'bg-slate-100 text-slate-600'}`}>
                        {a.priority || 'MEDIUM'}
                      </span>
                      {a.is_overdue && !submitted && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[9px] font-bold uppercase">
                          <AlertTriangle className="w-2.5 h-2.5" /> Overdue
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {a.template_name || a.template_id}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> {a.location_id || 'All Locations'}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" /> Due {fmtDate(a.due_date)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <ClipboardList className="w-3.5 h-3.5 text-slate-400" /> {a.frequency || 'ONE_TIME'}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                        {(tpl?.questions_count ?? a.questions_count) || 0} questions
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {noTemplate ? (
                      <span className="text-[10px] font-bold text-amber-600 uppercase">Checklist unavailable</span>
                    ) : (
                      <button
                        disabled={submitted}
                        onClick={() => onStartAudit && onStartAudit(a, tpl)}
                        className={`flex items-center gap-2 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md transition-all
                          ${submitted
                            ? 'bg-slate-400 opacity-60 cursor-not-allowed shadow-none'
                            : inProgress
                              ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20 cursor-pointer'
                              : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 cursor-pointer'}`}
                      >
                        <PlayCircle className="w-4 h-4" />
                        {submitted ? 'Completed' : inProgress ? 'Resume Audit' : 'Start Audit'}
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
