import React, { useMemo } from 'react';
import { MapPin, Layers, Check } from 'lucide-react';
import { clusterOptions, parseClusterList, serializeClusterList } from '../config/clusters';

/**
 * Home Cluster (mandatory, single) + Additional Clusters (optional, multi).
 * Emits { home_cluster, additional_cluster } — matches the `users` sheet columns.
 */
export default function ClusterFields({
  locations = [],
  homeCluster = '',
  additionalCluster = '',
  onChange
}) {
  const options = useMemo(() => clusterOptions(locations), [locations]);
  const additional = useMemo(() => parseClusterList(additionalCluster), [additionalCluster]);

  const has = (cluster) =>
    additional.some((c) => c.toLowerCase() === String(cluster).toLowerCase());

  const selectHome = (cluster) => {
    // A cluster is never both home and additional
    const next = additional.filter((c) => c.toLowerCase() !== String(cluster).toLowerCase());
    onChange({ home_cluster: cluster, additional_cluster: serializeClusterList(next) });
  };

  const toggleAdditional = (cluster) => {
    const next = has(cluster)
      ? additional.filter((c) => c.toLowerCase() !== String(cluster).toLowerCase())
      : [...additional, cluster];

    onChange({ home_cluster: homeCluster, additional_cluster: serializeClusterList(next) });
  };

  const selectable = options.filter(
    (c) => c.toLowerCase() !== String(homeCluster).toLowerCase()
  );

  return (
    <>
      <div>
        <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
          Home Cluster <span className="text-rose-500">*</span>
        </label>

        <div className="relative">
          <select
            required
            value={homeCluster}
            onChange={(event) => selectHome(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 pl-8 font-semibold text-slate-800"
          >
            <option value="">Select home cluster...</option>
            {options.map((cluster) => (
              <option key={cluster} value={cluster}>{cluster}</option>
            ))}
          </select>

          <MapPin className="absolute left-2.5 top-3 h-3.5 w-3.5 text-slate-400" />
        </div>

        {!options.length && (
          <p className="mt-1 text-[10px] font-bold text-amber-600">
            No clusters loaded from the POD master — check POD_SPREADSHEET_ID and the sheet tab name.
          </p>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-[11px] font-bold uppercase text-slate-600">
            Additional Clusters{' '}
            <span className="font-medium normal-case text-slate-400">(optional)</span>
          </label>

          <span className="text-[10px] font-bold text-slate-400">
            {additional.length} selected
          </span>
        </div>

        <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
          {selectable.length === 0 ? (
            <p className="p-1 text-[10px] font-semibold text-slate-400">
              {homeCluster ? 'No other clusters available.' : 'Pick a home cluster first.'}
            </p>
          ) : (
            selectable.map((cluster) => (
              <button
                key={cluster}
                type="button"
                onClick={() => toggleAdditional(cluster)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold transition-colors ${
                  has(cluster) ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-white'
                }`}
              >
                <span
                  className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border ${
                    has(cluster) ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
                  }`}
                >
                  {has(cluster) && <Check className="h-2.5 w-2.5 text-white" />}
                </span>
                {cluster}
              </button>
            ))
          )}
        </div>

        {additional.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {additional.map((cluster) => (
              <span
                key={cluster}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700"
              >
                <Layers className="h-2.5 w-2.5" />
                {cluster}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
