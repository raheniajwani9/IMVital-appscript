import React, { useMemo, useState } from 'react';
import { Search, Layers, Building2, Store, X, AlertTriangle, Check } from 'lucide-react';
import {
  citiesForClusters,
  podsForScope,
  podLabel,
  podKey,
  keepAllowed
} from '../constants/clusters';

const lower = (v) => String(v ?? '').trim().toLowerCase();
const has = (list, v) => list.some((x) => lower(x) === lower(v));
const toggle = (list, v) => (has(list, v) ? list.filter((x) => lower(x) !== lower(v)) : [...list, v]);

/** Small pill toggle, used for the auditor's clusters. */
function Chip({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
        active
          ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'
      }`}
    >
      {active && <Check className="h-3 w-3" />}
      {children}
    </button>
  );
}

/** Scrollable checkbox list with select-all / clear over whatever is visible. */
function CheckList({ items, selected, onToggle, onSelectAll, onClear, empty, renderItem }) {
  if (!items.length) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-white p-3 text-center text-[10px] font-bold text-slate-400">
        {empty}
      </p>
    );
  }

  return (
    <>
      <div className="mb-1 flex items-center gap-2 text-[10px] font-bold">
        <button type="button" onClick={onSelectAll} className="text-blue-600 hover:underline">
          Select all {items.length}
        </button>
        <span className="text-slate-300">|</span>
        <button type="button" onClick={onClear} className="text-slate-400 hover:text-slate-700">
          Clear
        </button>
      </div>

      <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white">
        {items.map((item) => {
          const { key, label, sub } = renderItem(item);
          const active = has(selected, key);

          return (
            <label
              key={key}
              className={`flex cursor-pointer items-center gap-2 border-b border-slate-100 px-2.5 py-1.5 last:border-b-0 ${
                active ? 'bg-blue-50/60' : 'hover:bg-slate-50'
              }`}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => onToggle(key)}
                className="h-3.5 w-3.5 flex-shrink-0 accent-blue-600"
              />
              <span className="truncate font-semibold text-slate-800">{label}</span>
              {sub && <span className="ml-auto flex-shrink-0 text-[10px] font-bold text-slate-400">{sub}</span>}
            </label>
          );
        })}
      </div>
    </>
  );
}

/**
 * Cascading, multi-select audit scope: Cluster(s) >> City(ies) >> POD(s).
 *
 * Cluster options are the ones the chosen auditor actually covers
 * (home_cluster + additional_cluster), so the scope can never fall outside
 * their remit. Fully controlled — the parent owns
 * { clusters, cities, pods } and gets the whole triple back on every change.
 */
export default function PodScopePicker({
  locations = [],
  allowedClusters = [],
  value = { clusters: [], cities: [], pods: [] },
  onChange,
  auditorName = '',
  label = 'Audit Scope'
}) {
  const [citySearch, setCitySearch] = useState('');
  const [podSearch, setPodSearch] = useState('');

  const { clusters = [], cities = [], pods = [] } = value;

  // Cities live under the selected clusters; PODs under the selected cities.
  const cityChoices = useMemo(
    () => citiesForClusters(locations, clusters),
    [locations, clusters]
  );

  const podChoices = useMemo(
    () => podsForScope(locations, { clusters, cities }),
    [locations, clusters, cities]
  );

  const visibleCities = useMemo(() => {
    const q = lower(citySearch);
    return q ? cityChoices.filter((c) => lower(c).includes(q)) : cityChoices;
  }, [cityChoices, citySearch]);

  const visiblePods = useMemo(() => {
    const q = lower(podSearch);
    if (!q) return podChoices;
    return podChoices.filter(
      (p) =>
        lower(p.pod_id).includes(q) ||
        lower(p.pod_code).includes(q) ||
        lower(podLabel(p)).includes(q)
    );
  }, [podChoices, podSearch]);

  const podCountByCity = useMemo(() => {
    const counts = {};
    locations.forEach((loc) => {
      if (!has(clusters, loc?.cluster)) return;
      const k = lower(loc?.city);
      if (k) counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  }, [locations, clusters]);

  /* Every emit re-narrows the child selections, so a de-selected cluster can
   * never leave orphaned cities or PODs in the payload. */
  const emit = (next) => {
    const nextClusters = next.clusters ?? clusters;
    const allowedCities = citiesForClusters(locations, nextClusters);
    const nextCities = keepAllowed(next.cities ?? cities, allowedCities);
    const allowedPods = podsForScope(locations, {
      clusters: nextClusters,
      cities: nextCities
    }).map(podKey);

    onChange?.({
      clusters: nextClusters,
      cities: nextCities,
      pods: keepAllowed(next.pods ?? pods, allowedPods)
    });
  };

  const reset = () => {
    setCitySearch('');
    setPodSearch('');
    onChange?.({ clusters: [], cities: [], pods: [] });
  };

  const dirty = clusters.length || cities.length || pods.length;

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
          {label}
        </span>

        {dirty ? (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-700"
          >
            <X className="h-3 w-3" />
            Reset
          </button>
        ) : null}
      </div>

      {/* 1 — Cluster, scoped to the auditor's home + additional clusters */}
      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
          <Layers className="h-3 w-3" />
          Cluster
          <span className="font-semibold normal-case text-slate-400">
            — {auditorName ? `${auditorName}'s coverage` : 'auditor coverage'}
          </span>
        </label>

        {allowedClusters.length ? (
          <div className="flex flex-wrap gap-1.5">
            {allowedClusters.map((c) => (
              <Chip key={c} active={has(clusters, c)} onClick={() => emit({ clusters: toggle(clusters, c) })}>
                {c}
              </Chip>
            ))}

            {allowedClusters.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  emit({
                    clusters: clusters.length === allowedClusters.length ? [] : [...allowedClusters]
                  })
                }
                className="rounded-full px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-700"
              >
                {clusters.length === allowedClusters.length ? 'None' : 'All'}
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 p-2 text-[10px] font-bold text-amber-700">
            <AlertTriangle className="mt-px h-3 w-3 flex-shrink-0" />
            <span>
              {auditorName || 'This auditor'} has no home or additional cluster. Set one in
              Users &amp; Roles before scheduling their audits.
            </span>
          </div>
        )}
      </div>

      {/* 2 — City, multi-select within the chosen clusters */}
      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
          <Building2 className="h-3 w-3" />
          City
          {cities.length ? (
            <span className="font-bold normal-case text-blue-600">{cities.length} selected</span>
          ) : null}
        </label>

        {cityChoices.length > 6 && (
          <div className="relative mb-1.5">
            <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-slate-400" />
            <input
              type="text"
              value={citySearch}
              onChange={(event) => setCitySearch(event.target.value)}
              placeholder="Filter cities..."
              className="w-full rounded-xl border border-slate-200 bg-white p-2 pl-7 text-[11px] font-semibold text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
            />
          </div>
        )}

        <CheckList
          items={visibleCities}
          selected={cities}
          empty={clusters.length ? 'No cities in the selected cluster(s).' : 'Select a cluster first.'}
          onToggle={(cityName) => emit({ cities: toggle(cities, cityName) })}
          onSelectAll={() => emit({ cities: [...new Set([...cities, ...visibleCities])] })}
          onClear={() => emit({ cities: [] })}
          renderItem={(cityName) => ({
            key: cityName,
            label: cityName,
            sub: `${podCountByCity[lower(cityName)] || 0} PODs`
          })}
        />
      </div>

      {/* 3 — POD, multi-select within the chosen cities */}
      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
          <Store className="h-3 w-3" />
          PODs
          {pods.length ? (
            <span className="font-bold normal-case text-blue-600">{pods.length} selected</span>
          ) : null}
        </label>

        {podChoices.length > 6 && (
          <div className="relative mb-1.5">
            <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-slate-400" />
            <input
              type="text"
              value={podSearch}
              onChange={(event) => setPodSearch(event.target.value)}
              placeholder="Search POD ID or name..."
              className="w-full rounded-xl border border-slate-200 bg-white p-2 pl-7 text-[11px] font-semibold text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
            />
          </div>
        )}

        <CheckList
          items={visiblePods}
          selected={pods}
          empty={cities.length ? 'No PODs in the selected cities.' : 'Select a city first.'}
          onToggle={(id) => emit({ pods: toggle(pods, id) })}
          onSelectAll={() => emit({ pods: [...new Set([...pods, ...visiblePods.map(podKey)])] })}
          onClear={() => emit({ pods: [] })}
          renderItem={(pod) => ({
            key: podKey(pod),
            label: `${podLabel(pod)}${pod.pod_code ? ` (${pod.pod_code})` : ''}`,
            sub: pod.city
          })}
        />

        <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold text-slate-400">
          <span>
            {pods.length
              ? `${pods.length} POD${pods.length > 1 ? 's' : ''} — one schedule row each`
              : 'No POD selected yet'}
          </span>
          <span>
            {visiblePods.length} of {podChoices.length} shown
          </span>
        </div>

        {pods.length > 100 && (
          <div className="mt-1.5 flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 p-2 text-[10px] font-bold text-amber-700">
            <AlertTriangle className="mt-px h-3 w-3 flex-shrink-0" />
            <span>
              This creates {pods.length} schedules in one go and emails the auditor a single
              digest. Double-check the city selection before saving.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
