import React, { useState } from 'react';
import { Loader2, X, Mail } from 'lucide-react';
import DatePicker from './DatePicker';

const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ONE_TIME'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export default function UpdateScheduleModal({ schedule, templates = [], locations = [], users = [], onClose, onUpdated }) {
  const [formData, setFormData] = useState({
    schedule_id: schedule.schedule_id,
    template_id: schedule.template_id || '',
    template_name: schedule.template_name || '',
    template_version: schedule.template_version || 'v1.0',
    location_id: schedule.location_id || 'All Locations',
    frequency: schedule.frequency || 'WEEKLY',
    assigned_auditor: schedule.assigned_auditor || 'System Admin',
    assigned_auditor_email: schedule.assigned_auditor_email || '',
    start_date: schedule.start_date || new Date().toISOString().split('T')[0],
    due_date: schedule.due_date || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    priority: schedule.priority || 'MEDIUM',
    status: schedule.status || 'SCHEDULED',
    active: schedule.active !== undefined ? schedule.active : true,
    created_by: schedule.created_by || 'Program Admin',
    created_at: schedule.created_at || new Date().toISOString()
  });

  const [submitting, setSubmitting] = useState(false);

  const handleTemplateSelect = (tmplId) => {
    const selectedTmpl = templates.find((t) => String(t.template_id || t.id || t.template_code) === String(tmplId));
    setFormData((prev) => ({
      ...prev,
      template_id: tmplId,
      template_name: selectedTmpl?.template_name || '',
      template_version: selectedTmpl?.template_version || 'v1.0'
    }));
  };

  const handleUserSelect = (userId) => {
    const selectedUser = users.find((u) => u.user_id === userId || u.email === userId);
    setFormData((prev) => ({
      ...prev,
      assigned_auditor: selectedUser?.full_name || selectedUser?.user_id || userId,
      assigned_auditor_email: selectedUser?.email || userId
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      ...formData,
      next_run_date: formData.start_date
    };

    if (typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler(() => {
          setSubmitting(false);
          if (onUpdated) onUpdated();
          onClose();
        })
        .withFailureHandler((err) => {
          console.error('Error updating schedule:', err);
          setSubmitting(false);
        })
        .apiUpdateSchedule(payload);
    } else {
      setTimeout(() => {
        setSubmitting(false);
        if (onUpdated) onUpdated();
        onClose();
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold text-blue-600 tracking-wider uppercase">Automation</span>
            <h2 className="text-lg font-black text-slate-900">Update Audit Schedule</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Checklist Standard</label>
            <select
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold"
              value={formData.template_id}
              onChange={(e) => handleTemplateSelect(e.target.value)}
            >
              {templates.map((t) => (
                <option key={t.template_id} value={t.template_id}>
                  {t.template_name} ({t.template_version || 'v1.0'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Location</label>
              <select
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold"
                value={formData.location_id}
                onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
              >
                {locations.length > 0 ? (
                  locations.map((l) => (
                    <option key={l.location_id} value={l.location_id}>
                      {l.location_name || l.location_id}
                    </option>
                  ))
                ) : (
                  <option value="All Locations">All Locations</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Assigned Auditor</label>
              {users.length > 0 ? (
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold"
                  value={formData.assigned_auditor_email || formData.assigned_auditor}
                  onChange={(e) => handleUserSelect(e.target.value)}
                >
                  {users.map((u) => (
                    <option key={u.user_id || u.email} value={u.user_id || u.email}>
                      {u.full_name ? `${u.full_name} (${u.email || u.user_id})` : u.email}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="auditor@company.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-8 font-semibold"
                    value={formData.assigned_auditor_email}
                    onChange={(e) => setFormData({ ...formData, assigned_auditor_email: e.target.value, assigned_auditor: e.target.value })}
                  />
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Frequency</label>
              <select
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold"
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Priority</label>
              <select
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Status</label>
              <select
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DatePicker
              label="Start Date"
              required
              value={formData.start_date}
              onChange={(val) => setFormData({ ...formData, start_date: val })}
            />
            <DatePicker
              label="Due Date"
              required
              min={formData.start_date}
              value={formData.due_date}
              onChange={(val) => setFormData({ ...formData, due_date: val })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 shadow-md"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Update Schedule</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}