import React, { useState, useMemo, useEffect } from 'react';
import {
  ClipboardCheck, Play, RotateCw, CheckCircle2,
  AlertTriangle, Search, ChevronLeft, ChevronRight, Timer
} from 'lucide-react';

const ITEMS_PER_PAGE = 8;

const STATUS_STYLES = {
  SCHEDULED: { label: 'Scheduled', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  IN_PROGRESS: { label: 'In Progress', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  SUBMITTED: { label: 'Submitted', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
};

const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'OVERDUE', label: 'Overdue' }
];

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
};

const getTemplate = (templates, item) =>
  templates.find(
    (t) =>
      String(t.template_id) === String(item.template_id) ||
      String(t.template_code) === String(item.template_id)
  );

const getAuditName = (item, templates, template = getTemplate(templates, item)) => {
  const storedName = String(item.template_name || '').trim();
  const isGeneratedTemplateId = storedName.startsWith('TMP-');

  return template?.template_name ||
    (!isGeneratedTemplateId && storedName) ||
    item.template_id ||
    'Untitled Audit';
};


const getAssignmentCategory = (assignment) => {
  if (
    assignment.re_audit_of ||
    assignment.re_audit_id ||
    assignment.is_reaudit ||
    String(assignment.audit_type || '').toUpperCase() === 'RE_AUDIT'
  ) {
    return 'RE_AUDITS';
  }

  const isPanIndia =
    String(assignment.audit_scope || '').toUpperCase() === 'PAN_INDIA' ||
    assignment.pan_india === true ||
    String(assignment.location_id || '').trim().toLowerCase() === 'all locations';

  return isPanIndia ? 'RECURRING' : 'SCHEDULED';
};
export default function MyAuditsView({ assignments = [], audits = [], templates = [], currentUser, onStartAudit, onRefreshData, category = 'ALL' }) {
  const auditList = assignments.length > 0 ? assignments : audits;

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL'); 
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [category]);

  const stats = useMemo(() => {
    const pending = auditList.filter((a) => ['SCHEDULED', 'NOT_STARTED'].includes(a.audit_status)).length;
    const inProgress = auditList.filter((a) => a.audit_status === 'IN_PROGRESS').length;
    const submitted = auditList.filter((a) => a.audit_status === 'SUBMITTED').length;
    const overdue = auditList.filter((a) => a.is_overdue && a.audit_status !== 'SUBMITTED').length;
    return { pending, inProgress, submitted, overdue };
  }, [auditList]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filteredResult = auditList.filter((a) => {

      if (category !== 'ALL' && getAssignmentCategory(a) !== category) return false;
      const currentStatus = a.audit_status || 'NOT_STARTED';

      // Status Filters
      if (filter === 'PENDING' && currentStatus !== 'SCHEDULED' && currentStatus !== 'NOT_STARTED') return false;
      if (filter === 'IN_PROGRESS' && currentStatus !== 'IN_PROGRESS') return false;
      if (filter === 'SUBMITTED' && currentStatus !== 'SUBMITTED') return false;
      if (filter === 'OVERDUE' && !(a.is_overdue && currentStatus !== 'SUBMITTED')) return false;

      // Priority FilterA
      const itemPriority = (a.priority || 'MEDIUM').toUpperCase();
      if (priorityFilter !== 'ALL' && itemPriority !== priorityFilter) return false;

      // Search Query
      if (!q) return true;
      return [a.audit_id, a.open_audit_id, getAuditName(a, templates), a.location_id, a.schedule_id, a.priority, a.frequency]
        .map((v) => String(v || '').toLowerCase())
        .some((v) => v.includes(q));
    });

    // Sort to show recently assigned first (using created_at or fallback to due_date)
    return filteredResult.sort((a, b) => {
      const dateA = new Date(a.created_at || a.due_date || 0).getTime();
      const dateB = new Date(b.created_at || b.due_date || 0).getTime();
      return dateB - dateA; // Descending order
    });

  }, [auditList, category, filter, priorityFilter, searchQuery, templates]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  return (
    <div className="space-y-6 font-sans text-slate-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-blue-600 tracking-wider uppercase">Assigned Inspections</span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Audits</h1>
          <p className="text-sm text-slate-500 mt-1">
            Checklists scheduled for {currentUser?.name || currentUser?.email}. Complete them before the due date.
          </p>
        </div>
      </div>

      {category === 'ALL' && (
        <>
          {/* Summary cards belong to the main My Audits view only. */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'To Do', value: stats.pending, icon: ClipboardCheck, tone: 'text-slate-900' },
              { label: 'In Progress', value: stats.inProgress, icon: Timer, tone: 'text-amber-600' },
              { label: 'Submitted', value: stats.submitted, icon: CheckCircle2, tone: 'text-emerald-600' },
              { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, tone: 'text-rose-600' }
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{card.label}</div>
                    <Icon className="w-3.5 h-3.5 text-slate-300" />
                  </div>
                  <div className={`text-2xl font-black mt-1 ${card.tone}`}>{card.value}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Search + filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by audit ID, checklist, store, or priority..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-4 py-1.5 text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setFilter(f.key);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filter === f.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}

          {/* Priority Dropdown added beside filters */}
          <div className="h-6 w-px bg-slate-200 mx-1"></div>
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-white border border-slate-200/80 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer hover:bg-slate-50"
          >
            <option value="ALL">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
      </div>

      {/* Assignment table */}
      {auditList.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center space-y-3">
          <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="text-sm font-bold text-slate-800">No Published Forms Available</div>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No published forms are available for {currentUser?.email} yet.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center space-y-2">
          <Search className="w-8 h-8 text-slate-300 mx-auto" />
          <div className="text-sm font-bold text-slate-800">No Matching Audits</div>
          <p className="text-xs text-slate-400">Try a different search or filter.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="divide-y divide-slate-100 lg:hidden">
            {paginated.map((assignment) => {
              const template = getTemplate(templates, assignment);
              const auditName = getAuditName(assignment, templates, template);
              const currentStatus = assignment.audit_status || 'NOT_STARTED';
              const status = STATUS_STYLES[currentStatus] || STATUS_STYLES.NOT_STARTED;
              const isSubmitted = currentStatus === 'SUBMITTED';
              const isOverdue = assignment.is_overdue && !isSubmitted;
              const isResume = currentStatus === 'IN_PROGRESS';
              const missingTemplate = !template || !(template.sections || []).length;

              return (
                <article key={assignment.schedule_id || assignment.audit_id} className={`p-4 ${isOverdue ? 'bg-rose-50/30' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="break-words text-sm font-bold text-slate-900">{auditName}</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {(template?.questions_count ?? assignment.questions_count) || 0} questions
                        {Number(template?.estimated_minutes || assignment.estimated_minutes) > 0 && ` · ~${template?.estimated_minutes || assignment.estimated_minutes} min`}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold uppercase ${assignment.priority === 'CRITICAL' || assignment.priority === 'HIGH' ? 'border border-rose-200 bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                      {assignment.priority || 'MEDIUM'}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 text-xs text-slate-600">
                      <span className="font-semibold text-slate-400">Location</span>
                      <span className="ml-2 break-words">{assignment.location_id || 'All Locations'}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase ${status.className}`}>{status.label}</span>
                      {isOverdue && <span className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-0.5 text-[9px] font-bold uppercase text-white"><AlertTriangle className="h-2.5 w-2.5" />Overdue</span>}
                    </div>
                  </div>

                  {isSubmitted && assignment.last_submitted_at && (
                    <p className="mt-2 text-[10px] font-bold text-emerald-600">Last submitted {formatDate(assignment.last_submitted_at)}{assignment.submission_count > 1 && ` · ${assignment.submission_count} submissions`}</p>
                  )}

                  <div className="mt-4">
                    {missingTemplate ? (
                      <p className="text-center text-[10px] font-bold uppercase text-amber-600">Checklist unavailable</p>
                    ) : (
                      <button
                        disabled={isSubmitted || isOverdue}
                        onClick={() => onStartAudit(assignment, template)}
                        className={`flex flex-wrap gap-1.5 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md transition-all bg-amber-600 hover:bg-amber-700 shadow-amber-500/20 cursor-pointer ${
                          isSubmitted || isOverdue
                            ? 'cursor-not-allowed bg-slate-400 opacity-60'
                            : isResume
                            ? 'cursor-pointer bg-amber-600 hover:bg-amber-700'
                            : 'cursor-pointer bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        <Play className="h-4 w-4" />
                        {isResume ? 'Resume Audit' : isSubmitted ? 'Completed' : 'Start Audit'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="overflow-x-auto">
            <table className="hidden w-full min-w-[1150px] border-collapse text-left text-xs lg:table">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Form Name</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
          {paginated.map((assignment) => {
            const template = getTemplate(templates, assignment);
            const auditName = getAuditName(assignment, templates, template);
            const currentStatus = assignment.audit_status || 'NOT_STARTED';
            const status = STATUS_STYLES[currentStatus] || STATUS_STYLES.NOT_STARTED;
            
            const isSubmitted = currentStatus === 'SUBMITTED';
            // NEW: Check if the audit is overdue and not yet submitted
            const isOverdue = assignment.is_overdue && !isSubmitted;
            const isResume = currentStatus === 'IN_PROGRESS';
            
            const missingTemplate = !template || !(template.sections || []).length;

            return (
              <tr
                key={assignment.schedule_id || assignment.audit_id}
                className={`align-top transition-colors hover:bg-slate-50 ${isOverdue ? 'bg-rose-50/30' : ''}`}
              >
                <td className="max-w-[240px] px-4 py-4">
                  <div className="truncate font-bold text-slate-900">{auditName}</div>
                  <div className="mt-1 text-[10px] text-slate-500">{(template?.questions_count ?? assignment.questions_count) || 0} questions{Number(template?.estimated_minutes || assignment.estimated_minutes) > 0 ? ` · ~${template?.estimated_minutes || assignment.estimated_minutes} min` : ''}</div>
                  {isSubmitted && assignment.last_submitted_at && <div className="mt-1 text-[10px] font-bold text-emerald-600">Last submitted {formatDate(assignment.last_submitted_at)}{assignment.submission_count > 1 && ` · ${assignment.submission_count} submissions`}</div>}
                </td>
                <td className="px-4 py-4 text-slate-700">{assignment.location_id || 'All Locations'}</td>
                <td className="px-4 py-4">
                  <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${assignment.priority === 'CRITICAL' || assignment.priority === 'HIGH' ? 'border border-rose-200 bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>{assignment.priority || 'MEDIUM'}</span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase ${status.className}`}
                    >
                      {status.label}
                    </span>
                    {isOverdue && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[9px] font-bold uppercase">
                        <AlertTriangle className="w-2.5 h-2.5" /> Overdue
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className=" flex-wrap">
                    {missingTemplate ? (
                      <span className="text-[10px] font-bold text-amber-600 uppercase">Checklist unavailable</span>
                    ) : (
                      <button
                        disabled={isSubmitted || isOverdue}
                        onClick={() => onStartAudit(assignment, template)}
                        className={`inline-flex items-center gap-2 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md transition-all ${
                          isSubmitted || isOverdue
                            ? 'bg-slate-400 opacity-60 cursor-not-allowed shadow-none'
                            : isResume
                            ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20 cursor-pointer'
                            : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 cursor-pointer'
                        }`}
                      >
                        <Play className="w-4 h-4" />
                        {isResume ? 'Resume Audit' : isSubmitted ? 'Completed' : 'Start Audit'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 rounded-2xl border border-slate-200/80 bg-white">
              <div className="text-[11px] font-bold text-slate-500">
                Showing <span className="text-slate-800">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
                <span className="text-slate-800">
                  {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}
                </span>{' '}
                of <span className="text-slate-800">{filtered.length}</span> assignments
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      currentPage === page
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
