/**
 * IM VITALS — POD / Cluster master + cluster helpers
 *
 * The POD master lives in its own spreadsheet, in the FLAT tab:
 *   POD ID | Action | Store Name | Cluster | City
 *
 * We deliberately do NOT read the pivot tab (Cluster -> city -> store_name):
 * it carries no POD ID column, so pod_id would have to be slugified from the
 * store name — and pod_id is a stored key in `schedules`, so a renamed store
 * would orphan its schedules. The flat tab has the same Cluster/City/Store
 * fields plus a stable id.
 */

/** POD master spreadsheet (separate from the app's own bound spreadsheet). */
const POD_SPREADSHEET_ID = '10vS4YqR2ppoNyjDrwGXU5Y6h8GLKF3YdjxbsY6K4wuw';

/** The one tab read from POD_SPREADSHEET_ID. */
const POD_SHEET_NAME = 'POD Management Sheet';

/** Column header aliases — matched case-insensitively against row 1. */
const POD_COLUMNS = {
  code:    ['pod id', 'pod_id', 'podid', 'store id', 'store_id', 'store code', 'store_code'],
  store:   ['store name', 'store_name', 'pod name', 'pod_name', 'location_name'],
  cluster: ['cluster', 'cluster name', 'cluster_name'],
  city:    ['city', 'city name', 'city_name'],
  action:  ['action', 'status', 'pod status', 'pod_status']
};

/** Columns written to the `schedules` sheet. ensureSheet_ adds any that are missing. */
const SCHEDULE_HEADERS = [
  'schedule_id', 'template_id', 'template_name', 'template_version',
  'pod_id', 'location_id', 'city', 'cluster',
  'frequency', 'next_run_date', 'assigned_auditor', 'assigned_auditor_email',
  'start_date', 'due_date', 'priority', 'status', 'end_date', 'active',
  'created_by', 'created_at'
];

/* -------------------------------------------------------------------------
 * Sheet-parsing helpers
 * ----------------------------------------------------------------------- */

/** Pivot exports carry "Guntur Total" / "Grand Total" rows — never real PODs. */
function isTotalRow_(value) {
  const s = String(value == null ? '' : value).trim().toLowerCase();
  if (!s) return false;
  return s === 'total' || s === 'grand total' || /\btotal$/.test(s);
}

/** Fallback POD id, used only when the master has no POD ID column. */
function slugifyPod_(name) {
  return 'POD-' + String(name || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function headerIndex_(headers, candidates, fallback) {
  for (let i = 0; i < candidates.length; i++) {
    const at = headers.indexOf(candidates[i]);
    if (at !== -1) return at;
  }
  return fallback;
}

function podCell_(row, idx) {
  if (idx < 0 || idx >= row.length) return '';
  return String(row[idx] == null ? '' : row[idx]).trim();
}

/* -------------------------------------------------------------------------
 * Cluster string helpers
 * ----------------------------------------------------------------------- */

function clustersFromLocations_(locations) {
  const seen = {};
  const out = [];

  (locations || []).forEach(function (l) {
    const cluster = String(l.cluster || '').trim();
    const k = cluster.toLowerCase();
    if (cluster && !seen[k]) { seen[k] = true; out.push(cluster); }
  });

  return out.sort();
}

/** "A, B ; C" -> ['A','B','C'], de-duped case-insensitively. */
function splitClusterCsv_(raw) {
  const seen = {};
  const out = [];

  String(raw || '').split(/[,;|]/).forEach(function (part) {
    const cluster = part.trim();
    const k = cluster.toLowerCase();
    if (cluster && !seen[k]) { seen[k] = true; out.push(cluster); }
  });

  return out;
}

/** Home cluster is never repeated inside additional_cluster. */
function normalizeClusterCsv_(raw, excludeCluster) {
  const skip = String(excludeCluster || '').trim().toLowerCase();
  return splitClusterCsv_(raw)
    .filter(function (c) { return c.toLowerCase() !== skip; })
    .join(', ');
}

/** Every cluster a user may audit: home + additional. */
function userClusters_(user) {
  if (!user) return [];

  const raw = [
    String(user.home_cluster || '').trim(),
    String(user.additional_cluster || user.additional_clusters || '').trim()
  ].filter(String).join(',');

  return splitClusterCsv_(raw);
}

/** Only PODs inside `clusters`. Empty list, or no match, returns everything. */
function locationsForClusters_(locations, clusters) {
  if (!clusters || !clusters.length) return locations;

  const allowed = {};
  clusters.forEach(function (c) { allowed[String(c).trim().toLowerCase()] = true; });

  const scoped = (locations || []).filter(function (l) {
    return allowed[String(l.cluster || '').trim().toLowerCase()];
  });

  return scoped.length ? scoped : locations;
}

/* -------------------------------------------------------------------------
 * POD lookups
 * ----------------------------------------------------------------------- */

/** Look a POD up by pod_id or by store name. Returns null for "All Locations". */
function resolvePod_(locationId, podId) {
  const want   = String(locationId || '').trim().toLowerCase();
  const wantId = String(podId || '').trim().toLowerCase();

  if (!want && !wantId) return null;
  if (want === 'all locations') return null;

  const found = getLocationsList().filter(function (l) {
    return (wantId && String(l.pod_id).toLowerCase() === wantId) ||
           (want && String(l.location_id).toLowerCase() === want);
  })[0];

  return found || null;
}

/** Distinct cluster names in the POD master. */
function getClustersList() {
  return clustersFromLocations_(getLocationsList());
}

/**
 * Run this from the Apps Script editor (Run > debugPodMaster) to sanity-check
 * the POD master parse before touching the UI.
 */
function debugPodMaster() {
  const locations = getLocationsList();
  const clusters = clustersFromLocations_(locations);

  Logger.log('PODs parsed: ' + locations.length);
  Logger.log('Clusters (' + clusters.length + '): ' + clusters.join(', '));
  Logger.log('First 5 rows: ' + JSON.stringify(locations.slice(0, 5), null, 2));

  return { pods: locations.length, clusters: clusters };
}
