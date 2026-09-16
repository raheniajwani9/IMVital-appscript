const lower = (v) => String(v ?? '').trim().toLowerCase();

// --- THE ULTIMATE DATA EXTRACTOR ---
// This safely reads your Supabase columns by ignoring spaces, underscores, and capital letters!
const getValue = (obj, searchTerms) => {
  if (!obj) return '';
  const keys = Object.keys(obj);
  for (let term of searchTerms) {
    // Strip out spaces/underscores and make lowercase to find a match
    const foundKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === term);
    if (foundKey && obj[foundKey]) return String(obj[foundKey]).trim();
  }
  return '';
};

// Maps to "cluster", "Cluster Name", "cluster_name", etc.
const getCluster = (l) => getValue(l, ['cluster', 'clustername']);
// Maps to "city", "City Name", "city_name", etc.
const getCity = (l) => getValue(l, ['city', 'cityname']);
// Maps to "pod_id", "POD ID", "Location ID", etc.
const getPodId = (l) => getValue(l, ['podid', 'locationid', 'storeid']);
// Maps to "store_name", "Store Name", "Location Name", etc.
const getPodName = (l) => getValue(l, ['storename', 'locationname', 'podname', 'name']);

/* -------------------------------------------------------------------------
 * Core Cluster Logic
 * ----------------------------------------------------------------------- */

export function clustersFromLocations(locations = []) {
  const seen = new Set();
  const out = [];

  locations.forEach((l) => {
    const cluster = getCluster(l);
    const k = cluster.toLowerCase();
    if (cluster && !seen.has(k)) { 
      seen.add(k); 
      out.push(cluster); 
    }
  });

  return out.sort();
}

export function splitClusterCsv(raw) {
  const seen = new Set();
  const out = [];

  String(raw || '').split(/[,;|]/).forEach((part) => {
    const cluster = part.trim();
    const k = cluster.toLowerCase();
    if (cluster && !seen.has(k)) { 
      seen.add(k); 
      out.push(cluster); 
    }
  });

  return out;
}

export function serializeClusterList(list) {
  if (!list || !list.length) return '';
  return list.join(', ');
}

export function parseClusterList(raw) {
  return splitClusterCsv(raw);
}

export function userClusters(user) {
  if (!user) return [];

  const raw = [
    String(user.home_cluster || '').trim(),
    String(user.additional_cluster || user.additional_clusters || '').trim()
  ].filter(Boolean).join(',');

  return splitClusterCsv(raw);
}

export function auditorsForCluster(users = [], targetCluster) {
  if (!targetCluster) return users;
  
  const target = lower(targetCluster);
  
  return users.filter(user => {
    const clusters = userClusters(user).map(lower);
    return clusters.includes(target);
  });
}

/* -------------------------------------------------------------------------
 * Location Filter Helpers (For PodSelector & PodScopePicker)
 * ----------------------------------------------------------------------- */

export function clusterOptions(locations = []) {
  return clustersFromLocations(locations);
}

export function cityOptions(locations = [], cluster = '') {
  const seen = new Set();
  const out = [];
  const targetCluster = lower(cluster);

  locations.forEach((l) => {
    if (targetCluster && lower(getCluster(l)) !== targetCluster) return;

    const city = getCity(l);
    const k = lower(city);
    if (city && !seen.has(k)) {
      seen.add(k);
      out.push(city);
    }
  });

  return out.sort();
}

export function filterPods(locations = [], { cluster = '', city = '', search = '' } = {}) {
  const targetCluster = lower(cluster);
  const targetCity = lower(city);
  const q = lower(search);

  return locations.filter((p) => {
    // 🛑 NEW: Filter out empty/invalid objects completely
    if (!getPodName(p) && !getPodId(p)) return false;

    if (targetCluster && lower(getCluster(p)) !== targetCluster) return false;
    if (targetCity && lower(getCity(p)) !== targetCity) return false;
    
    const nameMatch = lower(getPodName(p)).includes(q);
    const idMatch = lower(getPodId(p)).includes(q);
    if (q && !nameMatch && !idMatch) return false;
    
    return true;
  });
}


export function restrictLocations(locations = [], restrictToClusters = null) {
  if (!restrictToClusters || !restrictToClusters.length) return locations;
  
  const allowed = new Set(restrictToClusters.map(lower));
  return locations.filter(l => allowed.has(lower(getCluster(l))));
}

export function podLabel(pod) {
  if (!pod) return '';
  const name = getPodName(pod);
  const id = getPodId(pod);
  return name || id || 'Unknown POD';
}

export function podKey(pod) {
  if (!pod) return '';
  return getPodId(pod);
}

export function keepAllowed(selectedList = [], allowedList = []) {
  const allowedSet = new Set(allowedList.map(lower));
  return selectedList.filter(item => allowedSet.has(lower(item)));
}

export function citiesForClusters(locations = [], clusters = []) {
  if (!clusters || !clusters.length) return cityOptions(locations);
  
  const seen = new Set();
  const out = [];
  const allowedClusters = new Set(clusters.map(lower));

  locations.forEach((l) => {
    if (allowedClusters.has(lower(getCluster(l)))) {
      const city = getCity(l);
      const k = lower(city);
      if (city && !seen.has(k)) {
        seen.add(k);
        out.push(city);
      }
    }
  });

  return out.sort();
}

export function podsForScope(locations = [], { clusters = [], cities = [] } = {}) {
  const allowedClusters = new Set(clusters.map(lower));
  const allowedCities = new Set(cities.map(lower));

  return locations.filter(p => {
    // 🛑 NEW: Filter out empty/invalid objects completely
    if (!getPodName(p) && !getPodId(p)) return false;

    if (clusters.length && !allowedClusters.has(lower(getCluster(p)))) return false;
    if (cities.length && !allowedCities.has(lower(getCity(p)))) return false;
    return true;
  });
}