import React, { useState, useMemo } from 'react';
import {
  History, MapPin, Search, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle2, XCircle, Eye, Clock
} from 'lucide-react';
import AuditReportModal from '../components/AuditReportModal';

const ITEMS_PER_PAGE = 10;

const scoreTone = (percent) => {
  const value = Number(percent) || 0;
  if (value >= 90) return 'text-emerald-600';
  if (value >= 70) return 'text-amber-600';
  return 'text-rose-600';
};

// Includes IN_PROGRESS styling
const statusMeta = (status) => {
  const s = String(status || 'SUBMITTED').toUpperCase();
  if (s === 'APPROVED') return { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 };
  if (s === 'REJECTED') return { cls: 'bg-rose-50 text-rose-700 border-rose-200', Icon: XCircle };
  if (s === 'IN_PROGRESS') return { cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock };
  return { cls: 'bg-blue-50 text-blue-700 border-blue-200', Icon: CheckCircle2 };
};

// Formats raw ISO dates into clean readable text
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

export default function AuditHistoryView({ audits = [] }) {
  const [searchQuery, setSearchQuery] = useState('');
  // NEW: State for the status dropdown
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [report, setReport] = useState(null); // { audit_id, template_name }

  const allAudits = useMemo(
    () =>
      [...audits].sort((a, b) => String(b.submitted_at || b.started_at || '').localeCompare(String(a.submitted_at || a.started_at || ''))),
    [audits]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    
    return allAudits.filter((a) => {
      // 1. Status Filter Check
      const currentStatus = String(a.status || 'SUBMITTED').toUpperCase();
      if (statusFilter !== 'ALL' && currentStatus !== statusFilter) {
        return false;
      }

      // 2. Search Query Check
      if (!q) return true;
      return [a.template_name, a.location_id, a.audit_id, a.status]
        .map((v) => String(v || '').toLowerCase())
        .some((v) => v.includes(q));
    });
  }, [allAudits, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  return (
    <div className="space-y-6 font-sans text-slate-800">
      <div>
        <span className="text-[11px] font-bold text-blue-600 tracking-wider uppercase">Audit History</span>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">All Audits</h1>
        <p className="text-sm text-slate-500 mt-1">
          Review your ongoing and completed inspections — open <span className="font-semibold">Report</span> for the full breakdown.
        </p>
      </div>

      {/* SEARCH AND FILTERS BAR */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by checklist, store, or audit ID..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-4 py-1.5 text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* NEW: Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1); // Reset to page 1 on filter change
            }}
            className="bg-white border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer hover:bg-slate-50"
          >
            <option value="ALL">All Statuses</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <div className="text-xs font-bold text-slate-500 whitespace-nowrap">
            Total Records: <span className="text-slate-900 font-extrabold">{filtered.length}</span>
          </div>
        </div>
      </div>

      {/* TABLE CONTENT */}
      {filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center space-y-3">
          <History className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="text-sm font-bold text-slate-800">No Audits Found</div>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your search query or status filter to find what you're looking for.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <th className="p-4">Checklist</th>
                <th className="p-4">Location</th>
                <th className="p-4">Date</th>
                <th className="p-4">Answered</th>
                <th className="p-4">Score</th>
                <th className="p-4">Failures</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {paginated.map((audit) => {
                const { cls, Icon } = statusMeta(audit.status);
                const isSubmitted = ['SUBMITTED', 'APPROVED', 'REJECTED'].includes(String(audit.status).toUpperCase());
                
                return (
                  <tr key={audit.audit_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-900 text-xs">{audit.template_name || audit.template_id}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{audit.audit_id}</div>
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> {audit.location_id || 'All Locations'}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-slate-600">
                      {formatDate(audit.submitted_at || audit.started_at || audit.due_date)}
                    </td>
                    <td className="p-4 font-bold text-slate-600">
                      {audit.answered_questions || 0}/{audit.total_questions || 0}
                    </td>
                    <td className="p-4">
                      {isSubmitted ? (
                        <>
                          <span className={`font-black text-sm ${scoreTone(audit.score_percent)}`}>
                            {audit.score_percent || 0}%
                          </span>
                          <div className="text-[10px] text-slate-400 font-bold">
                            {audit.total_score || 0}/{audit.max_score || 0} pts
                          </div>
                          {audit.rating && (
                            <div className="text-[10px] text-slate-400 font-semibold">{audit.rating}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400 font-semibold italic text-[10px]">Pending</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-700">{audit.failure_count || 0}</div>
                      {Number(audit.critical_failures) > 0 && (
                        <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 text-[9px] font-bold uppercase">
                          <AlertTriangle className="w-2.5 h-2.5" /> {audit.critical_failures} critical
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-black uppercase ${cls}`}>
                        <Icon className="w-3 h-3" /> {audit.status || 'SUBMITTED'}
                      </span>
                      {audit.review_comment && (
                        <div
                          className="text-[10px] text-slate-400 mt-1 max-w-[160px] truncate"
                          title={audit.review_comment}
                        >
                          {audit.review_comment}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() =>
                          setReport({
                            audit_id: audit.audit_id,
                            template_name: audit.template_name || audit.template_id
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-[11px] font-bold hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Report
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* PAGINATION */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
              <div className="text-[11px] font-bold text-slate-500">
                Showing <span className="text-slate-800">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
                <span className="text-slate-800">{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</span> of{' '}
                <span className="text-slate-800">{filtered.length}</span> results
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 transition-all cursor-pointer"
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
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 transition-all cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {report && (
        <AuditReportModal
          auditId={report.audit_id}
          templateName={report.template_name}
          onClose={() => setReport(null)}
        />
      )}
    </div>
  );
}