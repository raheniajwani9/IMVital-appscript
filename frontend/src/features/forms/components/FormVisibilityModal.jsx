import React, { useMemo, useState } from 'react';
import { EyeOff, Loader2, X } from 'lucide-react';
import { supabase } from '../../../shared/lib/supabaseClient';
import { cityOptions, clusterOptions, filterPods, podCity, podCluster, podKey, podLabel } from '../../../shared/config/clusters';

export default function FormVisibilityModal({ form, locations = [], visibility, onClose, onSaved }) {
  const [mode, setMode] = useState(visibility?.mode || 'VISIBLE_ALL');
  const [hiddenPods, setHiddenPods] = useState(visibility?.hidden_pod_ids || []);
  const [cluster, setCluster] = useState('');
  const [city, setCity] = useState('');
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const pods = useMemo(() => filterPods(locations, { cluster, city, search }), [locations, cluster, city, search]);
  const selected = useMemo(() => new Set(hiddenPods.map(String)), [hiddenPods]);
  const togglePod = (id) => setHiddenPods((previous) =>
    previous.map(String).includes(String(id))
      ? previous.filter((value) => String(value) !== String(id))
      : [...previous, String(id)]
  );

  const save = async () => {
    if (mode === 'HIDDEN_SELECTED' && !hiddenPods.length) {
      setError('Select at least one POD to hide this form from.');
      return;
    }
    setSubmitting(true);
    setError('');
    const { error: saveError } = await supabase.from('form_visibility').upsert({
      template_id: form.template_id,
      mode,
      hidden_pod_ids: mode === 'HIDDEN_SELECTED' ? hiddenPods : [],
      updated_at: new Date().toISOString()
    }, { onConflict: 'template_id' });
    setSubmitting(false);
    if (saveError) {
      setError(saveError.code === '42P01' || saveError.code === 'PGRST205'
        ? 'Apply the form_visibility migration in Supabase first.'
        : saveError.message || 'Could not save visibility.');
      return;
    }
    onSaved?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Manage visibility</h2>
            <p className="mt-1 text-sm text-slate-500">{form.template_name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ['VISIBLE_ALL', 'Visible everywhere', 'All assigned PODs can audit'],
              ['HIDDEN_ALL', 'Hide everywhere', 'Block all PODs immediately'],
              ['HIDDEN_SELECTED', 'Hide selected PODs', 'Choose the blocked PODs']
            ].map(([value, title, description]) => (
              <button key={value} type="button" onClick={() => setMode(value)}
                className={`rounded-xl border p-3 text-left ${mode === value ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <span className="block text-sm font-bold text-slate-800">{title}</span>
                <span className="mt-1 block text-xs text-slate-500">{description}</span>
              </button>
            ))}
          </div>

          {mode === 'HIDDEN_SELECTED' && (
            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <select value={cluster} onChange={(event) => { setCluster(event.target.value); setCity(''); }} className="rounded-lg border border-slate-200 p-2 text-sm">
                  <option value="">All clusters</option>
                  {clusterOptions(locations).map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <select value={city} onChange={(event) => setCity(event.target.value)} className="rounded-lg border border-slate-200 p-2 text-sm">
                  <option value="">All cities</option>
                  {cityOptions(locations, cluster).map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search POD name or ID"
                className="w-full rounded-lg border border-slate-200 p-2 text-sm" />
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>{hiddenPods.length} PODs hidden</span>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setHiddenPods((previous) => [...new Set([...previous, ...pods.map(podKey).filter(Boolean)])])} className="text-indigo-600">Select shown</button>
                  <button type="button" onClick={() => setHiddenPods([])} className="text-slate-500">Clear</button>
                </div>
              </div>
              <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200">
                {pods.map((pod) => {
                  const id = podKey(pod);
                  if (!id) return null;
                  return <label key={id} className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50">
                    <input type="checkbox" checked={selected.has(String(id))} onChange={() => togglePod(id)} />
                    <span className="font-semibold text-slate-800">{podLabel(pod)} ({id})</span>
                    <span className="ml-auto text-xs text-slate-500">{podCluster(pod)} / {podCity(pod)}</span>
                  </label>;
                })}
                {!pods.length && <p className="p-3 text-sm text-slate-500">No matching PODs.</p>}
              </div>
            </div>
          )}

          {mode !== 'VISIBLE_ALL' && <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
            <EyeOff className="h-4 w-4 shrink-0" /> Auditors at hidden PODs will immediately lose access to new and in-progress audits. Existing records are retained.
          </p>}
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 p-5">
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
          <button type="button" onClick={save} disabled={submitting} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}{submitting ? 'Saving...' : 'Save visibility'}
          </button>
        </div>
      </div>
    </div>
  );
}
