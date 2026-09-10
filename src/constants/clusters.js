const norm = (v) => String(v ?? '').trim();
const key = (v) => norm(v).toLowerCase();

/** "A, B ; C" -> ['A','B','C'], de-duped case-insensitively. */
export function parseClusterList(raw) {
  const source = Array.isArray(raw) ? raw.join(',') : raw;
  const seen = new Set();
  const out = [];

  norm(source).split(/[,;|]/).forEach((part) => {
    const cluster = norm(part);
    if (!cluster || seen.has(key(cluster))) return;
    seen.add(key(cluster));
    out.push(cluster);
  });

  return out;
}

export const serializeClusterList = (list) => parseClusterList(list).join(', ');

/** Every cluster a user may audit: home + additional. */
export function userClusters(user) {
  if (!user) return [];

  return parseClusterList(
    [norm(user.home_cluster), norm(user.additional_cluster ?? user.additional_clusters)]
      .filter(Boolean)
      .join(',')
  );
}

export function userCoversCluster(user, cluster) {
  const want = key(cluster);
  if (!want) return false;
  return userClusters(user).some((c) => key(c) === want);
}

/** Distinct, sorted cluster names present in the POD master. */
export function clusterOptions(locations = []) {
  const seen = new Map();

  locations.forEach((loc) => {
    const cluster = norm(loc?.cluster);
    if (cluster && !seen.has(key(cluster))) seen.set(key(cluster), cluster);
  });

  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** Distinct, sorted cities — inside `cluster` when given, otherwise all. */
export function cityOptions(locations = [], cluster = '') {
  const want = key(cluster);
  const seen = new Map();

  locations.forEach((loc) => {
    if (want && key(loc?.cluster) !== want) return;
    const city = norm(loc?.city);
    if (city && !seen.has(key(city))) seen.set(key(city), city);
  });

  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export const podLabel = (loc) => norm(loc?.location_name || loc?.store_name || loc?.location_id);

/** Stable selection key for a POD row. */
export const podKey = (loc) => norm(loc?.pod_id || loc?.location_id);

/* --- Multi-select scope: clusters >> cities >> pods -------------------- */

/**
 * Distinct, sorted cities inside ANY of `clusters`.
 * An empty cluster list means "no cluster chosen yet" and yields no cities,
 * so the cascade cannot skip a step.
 */
export function citiesForClusters(locations = [], clusters = []) {
  const allowed = new Set(clusters.map(key).filter(Boolean));
  if (!allowed.size) return [];

  const seen = new Map();
  locations.forEach((loc) => {
    if (!allowed.has(key(loc?.cluster))) return;
    const city = norm(loc?.city);
    if (city && !seen.has(key(city))) seen.set(key(city), city);
  });

  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * PODs inside the selected clusters AND cities, narrowed by free text.
 * Both lists are AND-ed; an empty cities list yields nothing, for the same
 * reason as above.
 */
export function podsForScope(locations = [], { clusters = [], cities = [], search = '' } = {}) {
  const okCluster = new Set(clusters.map(key).filter(Boolean));
  const okCity = new Set(cities.map(key).filter(Boolean));
  if (!okCluster.size || !okCity.size) return [];

  const q = key(search);

  return locations.filter((loc) => {
    if (!okCluster.has(key(loc?.cluster))) return false;
    if (!okCity.has(key(loc?.city))) return false;
    if (!q) return true;

    return (
      key(loc?.pod_id).includes(q) ||
      key(loc?.pod_code).includes(q) ||
      key(podLabel(loc)).includes(q)
    );
  });
}

/** Drop selections that the narrower parent scope no longer allows. */
export const keepAllowed = (selected = [], allowed = []) => {
  const ok = new Set(allowed.map(key));
  return selected.filter((v) => ok.has(key(v)));
};

/** Cascading Cluster >> City filter, plus free text over POD ID / name / city / cluster. */
export function filterPods(locations = [], { cluster = '', city = '', search = '' } = {}) {
  const wantCluster = key(cluster);
  const wantCity = key(city);
  const q = key(search);

  return locations.filter((loc) => {
    if (wantCluster && key(loc?.cluster) !== wantCluster) return false;
    if (wantCity && key(loc?.city) !== wantCity) return false;
    if (!q) return true;

    return (
      key(loc?.pod_id).includes(q) ||
      key(loc?.pod_code).includes(q) ||
      key(podLabel(loc)).includes(q) ||
      key(loc?.city).includes(q) ||
      key(loc?.cluster).includes(q)
    );
  });
}

/** Users whose home or additional clusters cover `cluster`. Empty array = nobody. */
export function auditorsForCluster(users = [], cluster) {
  if (!cluster) return users;
  return users.filter((u) => userCoversCluster(u, cluster));
}

/** Only PODs inside the given clusters. Empty/blank list = no restriction. */
export function restrictLocations(locations = [], clusters = null) {
  if (!clusters || !clusters.length) return locations;
  const allowed = new Set(clusters.map((c) => key(c)));
  return locations.filter((loc) => allowed.has(key(loc?.cluster)));
}
