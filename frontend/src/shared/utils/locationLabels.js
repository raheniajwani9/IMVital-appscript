const normalize = (value) => String(value || '').trim().toLowerCase();

/** Resolve an assignment/audit location identifier to its human-readable POD name. */
export function getPodName(locations = [], value, fallback) {
  const raw = String(value || '').trim();
  if (!raw || normalize(raw) === 'all locations') return 'All Locations';

  const key = normalize(raw);
  const location = locations.find((item) => [
    item.pod_id,
    item.pod_name,
    item['POD Name'],
    item.location_id,
    item['Location ID'],
    item.store_id,
    item['Store Name'],
    item.store_name,
    item.location_name
  ].some((candidate) => normalize(candidate) === key));

  return location?.pod_name || location?.['POD Name'] || location?.['Store Name'] ||
    location?.store_name || location?.location_name || fallback || raw;
}
