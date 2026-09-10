import React, { useMemo, useState } from 'react';
import { Search, Layers, Building2, Store, X } from 'lucide-react';
import {
  clusterOptions,
  cityOptions,
  filterPods,
  podLabel,
  restrictLocations
} from '../constants/clusters';

const ALL = 'All Locations';

/**
 * Search box (POD ID / Name) + cascading Cluster >> City >> POD selectors.
 *
 * Fully controlled — the parent owns { pod_id, location_id, city, cluster }
 * and receives the whole quad back on every change.
 */
export default function PodSelector({
  locations = [],
  podId = '',
  locationId = ALL,
  city = '',
  cluster = '',
  onChange,
  restrictToClusters = null,
  allowAll = true,
  label = 'POD Selection'
}) {
  const [search, setSearch] = useState('');

  const available = useMemo(
    () => restrictLocations(locations, restrictToClusters),
    [locations, restrictToClusters]
  );

  const clusters = useMemo(() => clusterOptions(available), [available]);
  const cities = useMemo(() => cityOptions(available, cluster), [available, cluster]);
  const pods = useMemo(
    () => filterPods(available, { cluster, city, search }),
    [available, cluster, city, search]
  );

  const isAll = !locationId || locationId === ALL;

  // Keep the current selection visible even when the search filters it out
  const renderPods = useMemo(() => {
    if (isAll) return pods;
    if (pods.some((p) => String(p.location_id) === String(locationId))) return pods;

    const selected = available.find((p) => String(p.location_id) === String(locationId));
    return selected ? [selected, ...pods] : pods;
  }, [pods, available, locationId, isAll]);

  const emit = (patch) =>
    onChange?.({ pod_id: podId, location_id: locationId, city, cluster, ...patch });

  const handleCluster = (next) =>
    emit({ cluster: next, city: '', pod_id: '', location_id: ALL });

  const handleCity = (next) => emit({ city: next, pod_id: '', location_id: ALL });

  const handlePod = (next) => {
    if (!next || next === ALL) {
      emit({ pod_id: '', location_id: ALL });
      return;
    }

    const pod = available.find((p) => String(p.location_id) === String(next));
    emit({
      pod_id: pod?.pod_id || '',
      location_id: next,
      city: pod?.city || city,
      cluster: pod?.cluster || cluster
    });
  };

  const reset = () => {
    setSearch('');
    emit({ cluster: '', city: '', pod_id: '', location_id: ALL });
  };

  const selectClass =
    'w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-8 font-semibold text-slate-800 disabled:opacity-50';

  return (
    <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
          {label}
        </span>

        {(cluster || city || !isAll || search) && (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-700"
          >
            <X className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      {/* Direct search — POD ID or Name */}
      <div className="relative">
        <Search className="absolute left-2.5 top-3 h-3.5 w-3.5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search POD ID or name directly..."
          className="w-full rounded-xl border border-slate-200 bg-white p-2.5 pl-8 font-semibold text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {/* Cluster >> City */}
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
            Cluster
          </label>
          <div className="relative">
            <Layers className="absolute left-2.5 top-3 h-3.5 w-3.5 text-slate-400" />
            <select
              value={cluster}
              onChange={(event) => handleCluster(event.target.value)}
              className={selectClass}
            >
              <option value="">All Clusters</option>
              {clusters.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
            City
          </label>
          <div className="relative">
            <Building2 className="absolute left-2.5 top-3 h-3.5 w-3.5 text-slate-400" />
            <select
              value={city}
              onChange={(event) => handleCity(event.target.value)}
              disabled={!cities.length}
              className={selectClass}
            >
              <option value="">{cluster ? 'All Cities in Cluster' : 'All Cities'}</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* POD */}
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
          POD Name (POD ID)
        </label>
        <div className="relative">
          <Store className="absolute left-2.5 top-3 h-3.5 w-3.5 text-slate-400" />
          <select
            value={isAll ? ALL : locationId}
            onChange={(event) => handlePod(event.target.value)}
            className={selectClass}
          >
            {allowAll && (
              <option value={ALL}>
                {cluster
                  ? `All PODs in ${cluster}${city ? ` / ${city}` : ''}`
                  : 'All Locations'}
              </option>
            )}
            {renderPods.map((pod) => (
              <option
                key={pod.pod_id || `${pod.cluster}-${pod.city}-${pod.location_id}`}
                value={pod.location_id}
              >
                {podLabel(pod)}
                {pod.pod_code ? ` (${pod.pod_code})` : ''}
                {' — '}
                {pod.city}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-1 flex items-center justify-between text-[10px] font-bold text-slate-400">
          <span>Showing {pods.length} of {available.length} PODs</span>
          {!isAll && podId && <span className="text-slate-500">POD ID: {podId}</span>}
        </div>

        {search && !pods.length && (
          <p className="mt-1 text-[10px] font-bold text-amber-600">
            No POD matches "{search}" within the current Cluster / City filters.
          </p>
        )}
      </div>
    </div>
  );
}
