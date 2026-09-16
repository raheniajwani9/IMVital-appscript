import React, { useState, useMemo } from 'react';
import { Loader2, X, Mail, AlertTriangle } from 'lucide-react';
import DatePicker from './DatePicker';
import PodSelector from './PodSelector';
import { auditorsForCluster, userClusters } from '../constants/clusters';
import { supabase } from '../supabaseClient'; 

const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ONE_TIME'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export default function UpdateScheduleModal({
  schedule,
  templates = [],
  locations = [],
  users = [],
  onClose,
  onUpdated
}) {
  // Rows created before the cluster/city columns existed — recover from the master
  const matchedPod = useMemo(
    () =>
      locations.find(
        (l) =>
          String(l.location_id).toLowerCase() ===
          String(schedule.location_id || '').trim().toLowerCase()
      ),
    [locations, schedule.location_id]
  );

  const [formData, setFormData] = useState({
    schedule_id: schedule.schedule_id,
    template_id: schedule.template_id || '',
    template_name: schedule.template_name || '',
    template_version: schedule.template_version || 'v1.0',
    pod_id: schedule.pod_id || matchedPod?.pod_id || '',
    location_id: schedule.location_id || 'All Locations',
    city: schedule.city || matchedPod?.city || '',
    cluster: schedule.cluster || matchedPod?.cluster || '',
    frequency: schedule.frequency || 'WEEKLY',
    assigned_auditor: schedule.assigned_auditor || '',
    assigned_auditor_email: schedule.assigned_auditor_email || '',
    start_date: schedule.start_date || new Date().toISOString().split('T')[0],
    due_date:
      schedule.due_date || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    priority: schedule.priority || 'MEDIUM',
    status: schedule.status || 'SCHEDULED',
    active: schedule.active !== undefined ? schedule.active : true,
    created_by: schedule.created_by || 'Program Admin',
    created_at: schedule.created_at || new Date().toISOString()
  });

  const [ignoreClusterScope, setIgnoreClusterScope] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const scopedAuditors = useMemo(
    () => (formData.cluster ? auditorsForCluster(users, formData.cluster) : users),
    [users, formData.cluster]
  );

  const noneInCluster = Boolean(formData.cluster) && scopedAuditors.length === 0;

  // Never drop the auditor already on this schedule from the list
  const eligibleAuditors = useMemo(() => {
    const base = ignoreClusterScope || noneInCluster ? users : scopedAuditors;
    const current = formData.assigned_auditor_email;

    if (!current || base.some((u) => String(u.email || '') === String(current))) return base;

    const existing = users.find((u) => String(u.email || '') === String(current));
    return existing ? [existing, ...base] : base;
  }, [users, scopedAuditors, ignoreClusterScope, noneInCluster, formData.assigned_auditor_email]);

  const handleTemplateSelect = (tmplId) => {
    const selected = templates.find(
      (t) => String(t.template_id || t.id || t.template_code) === String(tmplId)
    );

    setFormData((prev) => ({
      ...prev,
      template_id: tmplId,
      template_name: selected?.template_name || '',
      template_version: selected?.template_version || 'v1.0'
    }));
  };

  const handleAuditorSelect = (value) => {
    const selected = users.find((u) => u.email === value || u.user_id === value);

    setFormData((prev) => ({
      ...prev,
      assigned_auditor: selected
        ? selected.full_name || selected.name || selected.email
        : value,
      assigned_auditor_email: selected ? selected.email || '' : value
    }));
  };

 const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const payload = { 
      template_id: formData.template_id,
      // REMOVED template_name FROM HERE
      location_id: formData.location_id,
      city: formData.city,
      frequency: formData.frequency,
      assigned_auditor: formData.assigned_auditor,
      assigned_auditor_email: formData.assigned_auditor_email,
      run_date: formData.start_date,
      due_date: formData.due_date,
      priority: formData.priority,
      status: formData.status
    };

    try {
      // 1. Update existing schedule in Supabase
      const { error: updateError } = await supabase
        .from('schedules')
        .update(payload)
        .eq('schedule_id', formData.schedule_id);

      if (updateError) throw updateError;

      // 2. DISPATCH EMAIL NOTIFICATION FOR UPDATE
      if (formData.assigned_auditor_email) {
        try {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: formData.assigned_auditor_email,
              auditorName: formData.assigned_auditor,
              templateName: formData.template_name, // STILL NEEDED HERE FOR THE EMAIL
              auditCount: 1, 
              dueDate: formData.due_date,
              priority: formData.priority,
              locations: [formData.location_id],
              isUpdate: true 
            })
          });
        } catch (emailErr) {
          console.error('Database updated, but failed to dispatch email:', emailErr);
        }
      }

      setSubmitting(false);
      if (onUpdated) onUpdated();
      onClose();

    } catch (err) {
      console.error('Error updating schedule:', err);
      setError(err.message || 'Failed to update schedule.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
              Automation
            </span>
            <h2 className="text-lg font-black text-slate-900">Update Audit Schedule</h2>
          </div>

          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-[11px] font-semibold flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
              Checklist Standard
            </label>
            <select
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-semibold"
              value={formData.template_id}
              onChange={(event) => handleTemplateSelect(event.target.value)}
            >
              {templates.map((t) => (
                <option key={t.template_id} value={t.template_id}>
                  {t.template_name} ({t.template_version || 'v1.0'})
                </option>
              ))}
            </select>
          </div>

          <PodSelector
            locations={locations}
            podId={formData.pod_id}
            locationId={formData.location_id}
            city={formData.city}
            cluster={formData.cluster}
            onChange={(next) => setFormData((prev) => ({ ...prev, ...next }))}
          />

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-[11px] font-bold uppercase text-slate-600">
                Assigned Auditor
              </label>

              {formData.cluster && !noneInCluster && (
                <label className="flex cursor-pointer items-center gap-1 text-[10px] font-bold text-slate-400">
                  <input
                    type="checkbox"
                    checked={ignoreClusterScope}
                    onChange={(event) => setIgnoreClusterScope(event.target.checked)}
                    className="h-3 w-3 accent-blue-600"
                  />
                  Show all users
                </label>
              )}
            </div>

            {eligibleAuditors.length > 0 ? (
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-semibold"
                value={formData.assigned_auditor_email || formData.assigned_auditor}
                onChange={(event) => handleAuditorSelect(event.target.value)}
              >
                {eligibleAuditors.map((u) => {
                  const clusters = userClusters(u);
                  return (
                    <option key={u.user_id || u.email} value={u.email || u.user_id}>
                      {u.full_name || u.name || u.email}
                      {u.email ? ` (${u.email})` : ''}
                      {clusters.length ? ` — ${clusters.join(', ')}` : ' — no cluster'}
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="auditor@company.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 pl-8 font-semibold"
                  value={formData.assigned_auditor_email}
                  onChange={(event) => handleAuditorSelect(event.target.value)}
                />
                <Mail className="absolute left-2.5 top-3 h-3.5 w-3.5 text-slate-400" />
              </div>
            )}

            {noneInCluster && (
              <div className="mt-1.5 flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 p-2 text-[10px] font-bold text-amber-700">
                <AlertTriangle className="mt-px h-3 w-3 flex-shrink-0" />
                <span>
                  No user has <strong>{formData.cluster}</strong> as home or additional cluster — showing all users.
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
                Frequency
              </label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-semibold"
                value={formData.frequency}
                onChange={(event) => setFormData({ ...formData, frequency: event.target.value })}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
                Priority
              </label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-semibold"
                value={formData.priority}
                onChange={(event) => setFormData({ ...formData, priority: event.target.value })}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
                Status
              </label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-semibold"
                value={formData.status}
                onChange={(event) => setFormData({ ...formData, status: event.target.value })}
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

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Update & Notify</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}