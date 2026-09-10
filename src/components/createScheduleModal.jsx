import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, X, UserCheck, AlertTriangle } from 'lucide-react';
import DatePicker from './DatePicker';
import PodScopePicker from './PodScopePicker';
import { userClusters, podsForScope, podKey, podLabel } from '../constants/clusters';

const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ONE_TIME'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const EMPTY_SCOPE = { clusters: [], cities: [], pods: [] };

export default function CreateScheduleModal({
  templates = [],
  locations = [],
  users = [],
  onClose,
  onCreated
}) {
  const [formData, setFormData] = useState({
    template_id: templates[0]?.template_id || '',
    template_name: templates[0]?.template_name || '',
    template_version: templates[0]?.template_version || 'v1.0',
    frequency: 'WEEKLY',
    assigned_auditor: '',
    assigned_auditor_email: '',
    start_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    priority: 'MEDIUM',
    status: 'SCHEDULED',
    active: true,
    created_by: 'Program Admin'
  });

  const [scope, setScope] = useState(EMPTY_SCOPE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Pick up templates once the API call lands
  useEffect(() => {
    if (!templates.length) return;

    setFormData((prev) => {
      if (prev.template_id) return prev;
      const first = templates[0];
      return {
        ...prev,
        template_id: first.template_id || first.id || '',
        template_name: first.template_name || '',
        template_version: first.template_version || 'v1.0'
      };
    });
  }, [templates]);

  const auditor = useMemo(
    () =>
      users.find(
        (u) => String(u.email || '') === String(formData.assigned_auditor_email)
      ) || null,
    [users, formData.assigned_auditor_email]
  );

  /** Only the clusters this auditor covers can be scheduled for them. */
  const allowedClusters = useMemo(() => userClusters(auditor), [auditor]);

  /** The chosen POD ids resolved back to full rows, for the payload. */
  const selectedPods = useMemo(() => {
    if (!scope.pods.length) return [];

    const wanted = new Set(scope.pods.map((id) => String(id).toLowerCase()));
    return podsForScope(locations, {
      clusters: scope.clusters,
      cities: scope.cities
    }).filter((pod) => wanted.has(podKey(pod).toLowerCase()));
  }, [locations, scope]);

  const handleTemplateSelect = (tmplId) => {
    const selected = templates.find(
      (t) => String(t.template_id || t.id) === String(tmplId)
    );

    setFormData((prev) => ({
      ...prev,
      template_id: tmplId,
      template_name: selected?.template_name || '',
      template_version: selected?.template_version || 'v1.0'
    }));
  };

  /**
   * Changing the auditor changes which clusters are legal, so the scope is
   * rebuilt from scratch — their full coverage is pre-selected, cities and
   * PODs start empty so the choice stays deliberate.
   */
  const handleAuditorSelect = (email) => {
    const selected = users.find((u) => String(u.email || '') === String(email));

    setError('');
    setFormData((prev) => ({
      ...prev,
      assigned_auditor: selected
        ? selected.full_name || selected.name || selected.email
        : '',
      assigned_auditor_email: selected ? selected.email || '' : ''
    }));

    setScope({ ...EMPTY_SCOPE, clusters: userClusters(selected) });
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!formData.assigned_auditor_email) {
      setError('Select the auditor first — their clusters drive the scope below.');
      return;
    }
    if (!selectedPods.length) {
      setError('Select at least one POD. Each selected POD becomes its own schedule.');
      return;
    }

    setError('');
    setSubmitting(true);

    const payload = {
      ...formData,
      next_run_date: formData.start_date,
      created_at: new Date().toISOString(),
      pods: selectedPods.map((pod) => ({
        pod_id: pod.pod_id || '',
        location_id: pod.location_id || podLabel(pod),
        city: pod.city || '',
        cluster: pod.cluster || ''
      }))
    };

    if (typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler(() => {
          setSubmitting(false);
          onCreated?.();
          onClose();
        })
        .withFailureHandler((err) => {
          console.error('Error creating schedules in Apps Script:', err);
          setError(err?.message || 'Apps Script rejected the request.');
          setSubmitting(false);
        })
        .apiCreateSchedules(payload);
    } else {
      setTimeout(() => {
        setSubmitting(false);
        onCreated?.();
        onClose();
      }, 500);
    }
  };

  const selectClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-semibold text-slate-800';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
              Automation
            </span>
            <h2 className="text-lg font-black text-slate-900">Schedule New Audit</h2>
          </div>

          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
              Checklist Standard
            </label>
            <select
              required
              className={selectClass}
              value={formData.template_id}
              onChange={(event) => handleTemplateSelect(event.target.value)}
            >
              {templates.map((t) => (
                <option key={t.template_id || t.id} value={t.template_id || t.id}>
                  {t.template_name} ({t.template_version || 'v1.0'})
                </option>
              ))}
            </select>
          </div>

          {/* Auditor comes FIRST — their coverage defines the cluster options */}
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-600">
              <UserCheck className="h-3.5 w-3.5" />
              Assigned Auditor
            </label>

            <select
              required
              className={selectClass}
              value={formData.assigned_auditor_email}
              onChange={(event) => handleAuditorSelect(event.target.value)}
            >
              <option value="">— Select an auditor —</option>
              {users.map((u) => {
                const clusters = userClusters(u);
                return (
                  <option key={u.user_id || u.email} value={u.email || ''}>
                    {u.full_name || u.name || u.email}
                    {clusters.length ? ` — ${clusters.join(', ')}` : ' — no cluster'}
                  </option>
                );
              })}
            </select>

            <p className="mt-1 text-[10px] font-bold text-slate-400">
              Clusters below are limited to this auditor's home + additional clusters.
            </p>
          </div>

          <PodScopePicker
            locations={locations}
            allowedClusters={allowedClusters}
            value={scope}
            onChange={setScope}
            auditorName={formData.assigned_auditor}
            label="POD Selection"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
                Recurrence Frequency
              </label>
              <select
                className={selectClass}
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
                className={selectClass}
                value={formData.priority}
                onChange={(event) => setFormData({ ...formData, priority: event.target.value })}
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

          {error && (
            <div className="flex items-start gap-1.5 rounded-xl border border-rose-200 bg-rose-50 p-2 text-[10px] font-bold text-rose-700">
              <AlertTriangle className="mt-px h-3 w-3 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedPods.length}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>
                Save {selectedPods.length > 1 ? `${selectedPods.length} Schedules` : 'Schedule'} &amp;
                Dispatch Email
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
