import React, { useState, useEffect } from 'react';
import { Loader2, X, Mail } from 'lucide-react';
import DatePicker from './DatePicker';

const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ONE_TIME'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function CreateScheduleModal({ templates = [], locations = [], users = [], onClose, onCreated }) {
  // Helper to extract store name string cleanly
  const getLocValue = (loc) => loc?.location_name || loc?.location_id || loc?.["Store Name"] || loc?.store_name || '';

  const [formData, setFormData] = useState({
    template_id: templates[0]?.template_id || '',
    template_name: templates[0]?.template_name || '',
    template_version: templates[0]?.template_version || 'v1.0',
    location_id: 'All Locations',
    frequency: 'WEEKLY',
    assigned_auditor: users[0]?.full_name || users[0]?.name || 'System Admin',
    assigned_auditor_email: users[0]?.email || '',
    start_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    priority: 'MEDIUM',
    status: 'SCHEDULED',
    active: true,
    created_by: 'Program Admin'
  });

  // Log incoming props for instant debugging in browser console
  useEffect(() => {
    console.log('CreateScheduleModal Props Loaded:', {
      templatesCount: templates.length,
      locationsCount: locations.length,
      usersCount: users.length,
      rawLocationsSample: locations.slice(0, 3)
    });
  }, [templates, locations, users]);

  // Sync state dynamically when props update after API fetch
  useEffect(() => {
    if (templates.length > 0 && !formData.template_id) {
      setFormData((prev) => ({
        ...prev,
        template_id: templates[0].template_id || templates[0].id || '',
        template_name: templates[0].template_name || '',
        template_version: templates[0].template_version || 'v1.0'
      }));
    }

    if (locations.length > 0 && (formData.location_id === 'All Locations' || !formData.location_id)) {
      const firstStore = getLocValue(locations[0]);
      if (firstStore) {
        setFormData((prev) => ({ ...prev, location_id: firstStore }));
      }
    }

    if (users.length > 0 && !formData.assigned_auditor_email) {
      setFormData((prev) => ({
        ...prev,
        assigned_auditor: users[0].full_name || users[0].name || users[0].email,
        assigned_auditor_email: users[0].email || ''
      }));
    }
  }, [templates, locations, users]);

  const [submitting, setSubmitting] = useState(false);

  const handleTemplateSelect = (tmplId) => {
    const selectedTmpl = templates.find((t) => String(t.template_id || t.id) === String(tmplId));
    setFormData((prev) => ({
      ...prev,
      template_id: tmplId,
      template_name: selectedTmpl?.template_name || '',
      template_version: selectedTmpl?.template_version || 'v1.0'
    }));
  };

  const handleAuditorSelect = (val) => {
    const selectedUser = users.find((u) => u.user_id === val || u.email === val || u.full_name === val);

    if (selectedUser) {
      setFormData((prev) => ({
        ...prev,
        assigned_auditor: selectedUser.full_name || selectedUser.name || selectedUser.email,
        assigned_auditor_email: selectedUser.email || ''
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        assigned_auditor: val,
        assigned_auditor_email: val
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      ...formData,
      schedule_id: `SCH-${Date.now()}`,
      next_run_date: formData.start_date,
      created_at: new Date().toISOString()
    };

    console.log('Submitting schedule payload:', payload);

    if (typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler((res) => {
          console.log('Schedule created successfully:', res);
          setSubmitting(false);
          if (onCreated) onCreated();
          onClose();
        })
        .withFailureHandler((err) => {
          console.error('Error creating schedule in Apps Script:', err);
          setSubmitting(false);
        })
        .apiCreateSchedule(payload);
    } else {
      setTimeout(() => {
        setSubmitting(false);
        if (onCreated) onCreated();
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
            <h2 className="text-lg font-black text-slate-900">Schedule New Audit</h2>
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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-800"
              value={formData.template_id}
              onChange={(e) => handleTemplateSelect(e.target.value)}
            >
              {templates.map((t) => (
                <option key={t.template_id || t.id} value={t.template_id || t.id}>
                  {t.template_name} ({t.template_version || 'v1.0'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Store / Location</label>
              <select
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-800"
                value={formData.location_id}
                onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
              >
                <option value="All Locations">All Locations</option>
                {locations
                  .map((loc) => getLocValue(loc))
                  .filter((name) => name && name !== 'All Locations')
                  .map((storeName, idx) => (
                    <option key={idx} value={storeName}>
                      {storeName}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Assigned Auditor</label>
              {users.length > 0 ? (
                <select
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-800"
                  value={formData.assigned_auditor_email || formData.assigned_auditor}
                  onChange={(e) => handleAuditorSelect(e.target.value)}
                >
                  {users.map((u) => (
                    <option key={u.user_id || u.email} value={u.email || u.user_id}>
                      {u.full_name || u.name ? `${u.full_name || u.name} (${u.email})` : u.email}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="auditor@company.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-8 font-semibold text-slate-800"
                    value={formData.assigned_auditor_email}
                    onChange={(e) => handleAuditorSelect(e.target.value)}
                  />
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Recurrence Frequency</label>
              <select
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-800"
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
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-800"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
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
              <span>Save & Dispatch Email</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}