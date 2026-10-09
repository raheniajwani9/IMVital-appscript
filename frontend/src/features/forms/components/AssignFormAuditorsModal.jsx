import React, { useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import PodScopePicker from '../../../shared/components/PodScopePicker';
import { podKey, podsForScope, userClusters } from '../../../shared/config/clusters';
import { supabase } from '../../../shared/lib/supabaseClient';
import { publishAssignments } from '../api/publishAssignments';

export default function AssignFormAuditorsModal({ form, users = [], locations = [], onClose, onAssigned }) {
  const [publishScope, setPublishScope] = useState('PAN_INDIA');
  const [selectedAuditorEmail, setSelectedAuditorEmail] = useState('');
  const [scope, setScope] = useState({ clusters: [], cities: [], pods: [] });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const auditors = useMemo(() => users.filter((user) =>
    String(user.role || '').toLowerCase().includes('auditor') &&
    String(user.active).toLowerCase() !== 'false' &&
    Boolean(user.email)
  ), [users]);
  const selectedAuditor = auditors.find((user) =>
    String(user.email).toLowerCase() === selectedAuditorEmail.toLowerCase()
  );
  const allowedClusters = useMemo(() => userClusters(selectedAuditor), [selectedAuditor]);
  const selectedPods = useMemo(() => {
    const selected = new Set(scope.pods.map((id) => String(id).toLowerCase()));
    return podsForScope(locations, { clusters: scope.clusters, cities: scope.cities })
      .filter((pod) => selected.has(podKey(pod).toLowerCase()));
  }, [locations, scope]);

  const handleAssign = async () => {
    setSubmitting(true);
    setError('');
    try {
      const count = await publishAssignments({
        supabase,
        templateId: form.template_id,
        publishScope,
        locations,
        auditors,
        selectedAuditor,
        selectedPods
      });
      if (count === 0) {
        setError('All selected auditors already have this form at the selected locations.');
        return;
      }
      onAssigned?.();
      onClose();
    } catch (assignmentError) {
      setError(assignmentError.message || 'Could not assign auditors.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Assign auditors</h2>
            <p className="mt-1 text-xs text-slate-500">{form.template_name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['PAN_INDIA', 'Pan India', 'All active auditors across locations'],
            ['TARGETED', 'Specific scope', 'One auditor and selected locations']
          ].map(([value, label, description]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPublishScope(value)}
              className={`rounded-xl border p-4 text-left ${publishScope === value ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <span className="block text-sm font-bold text-slate-800">{label}</span>
              <span className="mt-1 block text-xs text-slate-500">{description}</span>
            </button>
          ))}
        </div>

        {publishScope === 'TARGETED' && (
          <div className="mt-4 space-y-3 rounded-xl border border-slate-200 p-4">
            <label className="block text-xs font-semibold text-slate-600">Auditor</label>
            <select
              value={selectedAuditorEmail}
              onChange={(event) => {
                const email = event.target.value;
                const auditor = auditors.find((user) => user.email === email);
                setSelectedAuditorEmail(email);
                setScope({ clusters: userClusters(auditor), cities: [], pods: [] });
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select an auditor</option>
              {auditors.map((auditor) => (
                <option key={auditor.user_id || auditor.email} value={auditor.email}>
                  {auditor.full_name || auditor.name || auditor.email}
                </option>
              ))}
            </select>
            <PodScopePicker
              locations={locations}
              allowedClusters={allowedClusters}
              value={scope}
              onChange={setScope}
              auditorName={selectedAuditor?.full_name || selectedAuditor?.name || ''}
              label="Cluster, city, and location scope"
            />
          </div>
        )}

        {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
          <button type="button" onClick={handleAssign} disabled={submitting} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Assigning...' : 'Assign auditors'}
          </button>
        </div>
      </div>
    </div>
  );
}
