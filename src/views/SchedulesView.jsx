import React, { useState, useMemo } from 'react';
import { Plus, Calendar, MapPin, User, CheckCircle2, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import CreateScheduleModal from '../components/createScheduleModal';
import UpdateScheduleModal from '../components/UpdateScheduleModal';
import DeleteScheduleModal from '../components/DeleteScheduleModal';

const ITEMS_PER_PAGE = 10;

export default function SchedulesView({ schedules = [], templates = [], locations = [], users = [], onRefreshData }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [deletingSchedule, setDeletingSchedule] = useState(null);

  // Search & Pagination States
  const [searchQuery, setSearchQuery] = useState('');
  const [dateSort, setDateSort] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const handleEdit = (e, sch) => {
    e.stopPropagation();
    setEditingSchedule(sch);
  };

  const handleDelete = (e, sch) => {
    e.stopPropagation();
    setDeletingSchedule(sch);
  };

  const getTemplateTitle = (sch) => {
    if (sch.template_name && sch.template_name.trim() !== '' && !sch.template_name.startsWith('TMP-')) {
      return sch.template_name;
    }
    const matched = templates.find((t) => String(t.template_id || t.id || t.template_code) === String(sch.template_id));
    return matched?.template_name || matched?.template_code || sch.template_id || 'Standard Checklist';
  };

  // Search schedules, then optionally order them by due date.
  const filteredSchedules = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const result = schedules.filter((sch) => {
      if (!q) return true;
      const title = getTemplateTitle(sch).toLowerCase();
      const schId = String(sch.schedule_id || '').toLowerCase();
      const location = String(sch.location_id || '').toLowerCase();
      const auditor = String(sch.assigned_auditor || '').toLowerCase();
      const email = String(sch.assigned_auditor_email || '').toLowerCase();

      return title.includes(q) || schId.includes(q) || location.includes(q) || auditor.includes(q) || email.includes(q);
    });
    if (dateSort !== 'all') {
      const direction = dateSort === 'ascending' ? 1 : -1;
      result.sort((a, b) => {
        const dateA = Date.parse(a.due_date || '') || 0;
        const dateB = Date.parse(b.due_date || '') || 0;
        return (dateA - dateB) * direction;
      });
    }
    return result;
  }, [schedules, searchQuery, templates, dateSort]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredSchedules.length / ITEMS_PER_PAGE) || 1;
  const paginatedSchedules = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSchedules.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSchedules, currentPage]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Reset to page 1 on new search
  };

  return (
      <div className="space-y-6 font-sans text-slate-800">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-blue-600 tracking-wider uppercase">Automated Audits</span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Audit Schedules</h1>
          <p className="text-sm text-slate-500 mt-1">Configure recurring audit routines across operational locations.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-all"
        >
          <Plus className="w-4 h-4" /> Schedule Audit
        </button>
      </div>

      {/* Search Bar Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search schedules by title, store, or auditor..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-4 py-1.5 text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500 whitespace-nowrap">
            Due date
            <select
              value={dateSort}
              onChange={(event) => { setDateSort(event.target.value); setCurrentPage(1); }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">All dates</option>
              <option value="ascending">Ascending</option>
              <option value="descending">Descending</option>
            </select>
          </label>
          <div className="text-xs font-bold text-slate-500 pr-2 whitespace-nowrap">
            Total: <span className="text-slate-900 font-extrabold">{filteredSchedules.length}</span>
          </div>
        </div>
      </div>

      {/* Main Table / Empty State */}
      {schedules.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center space-y-3">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="text-sm font-bold text-slate-800">No Schedules Configured</div>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">Start scheduling recurring audits for standard compliance checks.</p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
          >
            + Create First Schedule
          </button>
        </div>
      ) : filteredSchedules.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center space-y-2">
          <Search className="w-8 h-8 text-slate-300 mx-auto" />
          <div className="text-sm font-bold text-slate-800">No Matching Schedules Found</div>
          <p className="text-xs text-slate-400">Try adjusting your search query "{searchQuery}"</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <th className="p-4">Schedule Details</th>
                <th className="p-4">Location</th>
                <th className="p-4">Frequency</th>
                <th className="p-4">Assigned To</th>
                <th className="p-4">Due Date</th>
                <th className="p-4">Priority</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {paginatedSchedules.map((sch) => {
                const title = getTemplateTitle(sch);
                return (
                  <tr key={sch.schedule_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-900 text-xs">{title}</div>
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> {sch.location_id || 'All Locations'}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-slate-600">{sch.frequency}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{sch.assigned_auditor || 'System Admin'}</span>
                      </div>
                      {sch.assigned_auditor_email && (
                        <div className="text-[10px] text-blue-600 font-medium ml-5">
                          {sch.assigned_auditor_email}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{sch.due_date || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        sch.priority === 'CRITICAL' || sch.priority === 'HIGH' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {sch.priority || 'MEDIUM'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-1 font-bold text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {sch.status || 'SCHEDULED'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => handleEdit(e, sch)}
                        aria-label={`Edit schedule ${sch.schedule_id}`}
                        title="Edit schedule"
                        className="text-blue-600 hover:text-blue-700 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, sch)}
                        aria-label={`Delete schedule ${sch.schedule_id}`}
                        title="Delete schedule"
                        className="text-rose-600 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
              <div className="text-[11px] font-bold text-slate-500">
                Showing <span className="text-slate-800">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
                <span className="text-slate-800">{Math.min(currentPage * ITEMS_PER_PAGE, filteredSchedules.length)}</span> of{' '}
                <span className="text-slate-800">{filteredSchedules.length}</span> results
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      currentPage === page
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {isCreateOpen && (
        <CreateScheduleModal
          templates={templates}
          locations={locations}
          users={users}
          onClose={() => setIsCreateOpen(false)}
          onCreated={onRefreshData}
        />
      )}

      {editingSchedule && (
        <UpdateScheduleModal
          schedule={editingSchedule}
          templates={templates}
          locations={locations}
          users={users}
          onClose={() => setEditingSchedule(null)}
          onUpdated={onRefreshData}
        />
      )}

      {deletingSchedule && (
        <DeleteScheduleModal
          schedule={deletingSchedule}
          onClose={() => setDeletingSchedule(null)}
          onDeleted={onRefreshData}
        />
      )}
    </div>
  );
}
