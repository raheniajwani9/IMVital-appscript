import { parseBool } from './auditEngine';

/* ------------------------------ primitives ------------------------------ */
const norm  = (v) => String(v ?? '').trim();
const key   = (v) => norm(v).toLowerCase();
const token = (v) => norm(v).toUpperCase().replace(/[\s-]+/g, '_');
const num   = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const round1 = (n) => Math.round(n * 10) / 10;
const share  = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

const DAY = 86400000;

export function toDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

const SUBMITTED_STATUSES = ['SUBMITTED', 'APPROVED', 'COMPLETED', 'REVIEWED'];
const CLOSED_ACTIONS     = ['CLOSED', 'RESOLVED', 'DONE', 'COMPLETED', 'VERIFIED'];

const auditDate      = (a) => toDate(a.submitted_at) || toDate(a.created_at) || toDate(a.scheduled_date) || toDate(a.audit_date);
const criticalCount  = (a) => num(a.critical_failures) || num(a.critical_feature) || num(a.critical_count);
const isSubmitted    = (a) => SUBMITTED_STATUSES.indexOf(token(a.status)) !== -1;
const isClosedAction = (x) => CLOSED_ACTIONS.indexOf(token(x.status)) !== -1;

/* Helper: extract cluster from any object across common field name variants */
const extractCluster = (row) =>
  norm(row?.cluster ?? row?.Cluster ?? row?.cluster_name ?? row?.home_cluster ??
        row?.location_cluster ?? row?.location_cluster_name ?? row?.region ??
        row?.area ?? row?.zone ?? row?.territory);

/* Helper: extract template name from any object */
const extractTemplate = (row) =>
  norm(row?.template_name ?? row?.template_id ?? row?.form_name ?? row?.form_id);

/* Helper: extract auditor email from audit row */
const extractAuditorEmail = (a) =>
  key(a?.auditor_email ?? a?.auditor_id ?? a?.assigned_auditor_email ?? a?.assigned_auditor);

/* Helper: extract location identifier — handles pod_id, "Location ID", and "Store Name" */
const extractLocationId = (row) =>
  key(row?.location_id ?? row?.pod_id ?? row?.['Location ID'] ?? row?.['Store Name'] ?? row?.locationID ?? row?.LocationID);

export const STATUS_COLORS = {
  SUBMITTED: '#10b981', IN_PROGRESS: '#f59e0b', APPROVED: '#3b82f6',
  REJECTED: '#ef4444', COMPLETED: '#8b5cf6', DRAFT: '#94a3b8', UNKNOWN: '#cbd5e1'
};

export const PRIORITY_COLORS = {
  CRITICAL: '#e11d48', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#0ea5e9', UNSET: '#94a3b8'
};

const SCORE_BUCKETS = [
  { range: '0–20%',   max: 20,  color: '#ef4444' },
  { range: '21–40%',  max: 40,  color: '#f97316' },
  { range: '41–60%',  max: 60,  color: '#f59e0b' },
  { range: '61–80%',  max: 80,  color: '#84cc16' },
  { range: '81–100%', max: 100, color: '#10b981' }
];

const titleCase = (s) =>
  norm(s).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Distinct, sorted, non-empty values pulled off a list of rows. */
export function distinctValues(rows, ...fields) {
  const seen = new Map();
  (rows || []).forEach((r) => {
    fields.forEach((f) => {
      const v = norm(r?.[f]);
      if (v && !seen.has(key(v))) seen.set(key(v), v);
    });
  });
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** Rolls audits up by any key, with score / pass / failure aggregates. */
function aggregate(audits, keyFn, labelField = 'name') {
  const map = new Map();

  audits.forEach((a) => {
    const k = norm(keyFn(a)) || 'Unmapped';
    if (!map.has(k)) {
      map.set(k, { audits: 0, scoreSum: 0, passed: 0, failed: 0, failures: 0, critical: 0 });
    }
    const g = map.get(k);
    g.audits++;
    g.scoreSum += num(a.score_percent);
    if (token(a.result) === 'PASSED') g.passed++;
    else if (token(a.result) === 'FAILED') g.failed++;
    g.failures += num(a.failure_count);
    g.critical += criticalCount(a);
  });

  return [...map.entries()]
    .map(([k, g]) => ({
      [labelField]: k,
      auditCount: g.audits,
      avgScore: round1(g.scoreSum / g.audits),
      passed: g.passed,
      failed: g.failed,
      failures: g.failures,
      critical: g.critical,
      passRate: share(g.passed, g.audits)
    }))
    .sort((a, b) => b.auditCount - a.auditCount);
}

/** Daily buckets for short windows, weekly for long ones. */
function buildTrend(audits, since, now) {
  const start = since || (audits.reduce((min, a) => {
    const d = auditDate(a);
    return d && (!min || d < min) ? d : min;
  }, null) || new Date(now.getTime() - 30 * DAY));

  const spanDays = Math.max(1, Math.ceil((now - start) / DAY));
  const weekly = spanDays > 31;
  const step = weekly ? 7 : 1;
  const buckets = [];

  for (let offset = 0; offset < spanDays; offset += step) {
    const from = new Date(start.getTime() + offset * DAY);
    const to = new Date(Math.min(from.getTime() + step * DAY, now.getTime() + DAY));
    buckets.push({
      date: from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      from, to, count: 0, scoreSum: 0, failures: 0, critical: 0
    });
  }

  audits.forEach((a) => {
    const d = auditDate(a);
    if (!d) return;
    const b = buckets.find((x) => d >= x.from && d < x.to);
    if (!b) return;
    b.count++;
    b.scoreSum += num(a.score_percent);
    b.failures += num(a.failure_count);
    b.critical += criticalCount(a);
  });

  return buckets.map((b) => ({
    date: b.date,
    count: b.count,
    avgScore: b.count ? round1(b.scoreSum / b.count) : null,
    failures: b.failures,
    critical: b.critical
  }));
}

/**
 * Everything the admin dashboard renders, derived from the getProgramAdminData payload.
 * filters: { days: number|null, cluster: string, template: string, auditor: string }
 */
export function computeAdminAnalytics(data = {}, filters = {}) {
  const days = filters.days === undefined ? null : filters.days;
  const wantCluster   = key(filters.cluster);
  const wantTemplate  = key(filters.template);
  const wantAuditor   = key(filters.auditor);

  const now = new Date();
  const since = days ? new Date(now.getTime() - days * DAY) : null;

  const allAudits   = data.audits || [];
  const allResponses = data.response || data.responses || [];
  const allActions  = data.actions || [];
  const schedules   = data.schedules || [];
  const users       = data.users || [];
  const locations   = data.locations || [];
  const activityLog = data.activityLog || [];

  /* ------------------- location → cluster lookup ------------------- */
  // FIX: Key by pod_id, "Location ID", AND "Store Name" because audits
  // store the store name (e.g. "Vagator") as location_id, not the numeric pod_id
  const locClusterMap = new Map();
  locations.forEach((l) => {
    const cl = extractCluster(l);
    if (!cl) return;
    if (l.pod_id)             locClusterMap.set(key(l.pod_id), cl);
    if (l['Location ID'])     locClusterMap.set(key(l['Location ID']), cl);
    if (l['Store Name'])      locClusterMap.set(key(l['Store Name']), cl);
    if (l.location_id)        locClusterMap.set(key(l.location_id), cl);
  });

  // Build schedule_id → cluster map (schedules have no cluster, but enrich locClusterMap)
  const scheduleClusterMap = new Map();
  schedules.forEach((s) => {
    const sid = norm(s.schedule_id);
    const cl  = extractCluster(s);
    if (sid && cl) scheduleClusterMap.set(sid, cl);
    const lid = key(s.location_id);
    if (lid && cl && !locClusterMap.has(lid)) locClusterMap.set(lid, cl);
  });

  // resolveCluster: 3 fallbacks — row → location → schedule
  const resolveCluster = (a) => {
    // 1. Direct from the audit row itself
    const direct = extractCluster(a);
    if (direct) return direct;

    // 2. From location lookup via location_id / pod_id / "Store Name"
    const lid = extractLocationId(a);
    if (lid && lid !== 'all_locations' && locClusterMap.has(lid)) return locClusterMap.get(lid);

    // 3. From schedule lookup via schedule_id
    const sid = norm(a.schedule_id);
    if (sid && scheduleClusterMap.has(sid)) return scheduleClusterMap.get(sid);

    return '';
  };

  /* ---------------------------- scope filters --------------------------- */
  const inScope = (row) => {
    if (wantCluster && key(resolveCluster(row)) !== wantCluster) return false;
    if (wantTemplate) {
      const t = key(extractTemplate(row));
      if (t !== wantTemplate) return false;
    }
    if (wantAuditor) {
      const aEmail = extractAuditorEmail(row);
      if (aEmail !== wantAuditor) return false;
    }
    return true;
  };

  const inWindow = (row) => {
    if (!since) return true;
    const d = auditDate(row);
    return d ? d >= since : false;
  };

  const audits    = allAudits.filter((a) => inScope(a) && inWindow(a));
  const auditIds  = new Set(audits.map((a) => String(a.audit_id)));
  const responses = allResponses.filter((r) => auditIds.has(String(r.audit_id)));
  const actions   = allActions.filter((x) => auditIds.has(String(x.audit_id)) || !x.audit_id);

  const submitted  = audits.filter(isSubmitted);
  const inProgress = audits.filter((a) => token(a.status) === 'IN_PROGRESS');
  const rejected   = audits.filter((a) => token(a.status) === 'REJECTED');
  const passed     = submitted.filter((a) => token(a.result) === 'PASSED');
  const failed     = submitted.filter((a) => token(a.result) === 'FAILED');

  const avgScore = submitted.length
    ? round1(submitted.reduce((s, a) => s + num(a.score_percent), 0) / submitted.length)
    : 0;

  /* -------------------------------- actions ----------------------------- */
  const openActions     = actions.filter((x) => !isClosedAction(x));
  const criticalOpen    = openActions.filter((x) => token(x.priority) === 'CRITICAL');
  const unassignedOpen  = openActions.filter((x) => !norm(x.owner_email));
  const overdueActions  = openActions.filter((x) => {
    const due = toDate(x.due_date);
    return due && due < now;
  });

  const actionsByPriority = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => ({
    label: titleCase(p),
    count: openActions.filter((x) => token(x.priority) === p).length,
    color: PRIORITY_COLORS[p]
  })).filter((r) => r.count > 0);

  const ageBuckets = [
    { range: '0–7 d',  color: '#10b981', count: 0 },
    { range: '8–30 d', color: '#f59e0b', count: 0 },
    { range: '31–60 d', color: '#f97316', count: 0 },
    { range: '60+ d',  color: '#ef4444', count: 0 }
  ];
  openActions.forEach((x) => {
    const created = toDate(x.created_at);
    if (!created) return;
    const age = (now - created) / DAY;
    if (age <= 7) ageBuckets[0].count++;
    else if (age <= 30) ageBuckets[1].count++;
    else if (age <= 60) ageBuckets[2].count++;
    else ageBuckets[3].count++;
  });

  const closed = actions.filter(isClosedAction);
  const resolutionDays = closed.map((x) => {
    const a = toDate(x.created_at), b = toDate(x.updated_at);
    return a && b && b >= a ? (b - a) / DAY : null;
  }).filter((v) => v !== null);
  const avgResolutionDays = resolutionDays.length
    ? round1(resolutionDays.reduce((s, v) => s + v, 0) / resolutionDays.length)
    : 0;

  /* ------------------------------ schedules ----------------------------- */
  const submittedScheduleIds = new Set(
    submitted.map((a) => String(a.schedule_id)).filter((s) => s && s !== 'undefined')
  );

  const liveSchedules = schedules.filter((s) => {
    if (norm(s.active) !== '' && !parseBool(s.active)) return false;
    if (['COMPLETED', 'CANCELLED', 'ARCHIVED'].indexOf(token(s.status)) !== -1) return false;
    return inScope(s);
  });

  const decorateSchedule = (s) => ({
    schedule_id: s.schedule_id,
    template_name: s.template_name || s.template_id || '—',
    location_id: s.location_id || s.pod_id || s['Location ID'] || '—',
    cluster: resolveCluster(s) || '—',
    city: s.city || s.City || '—',
    auditor: s.assigned_auditor || s.assigned_auditor_email || 'Unassigned',
    priority: token(s.priority) || 'MEDIUM',
    due_date: s.due_date || s.next_run_date || '',
    daysLate: (() => {
      const due = toDate(s.due_date) || toDate(s.next_run_date);
      return due ? Math.floor((now - due) / DAY) : 0;
    })()
  });

  const overdueSchedules = liveSchedules
    .filter((s) => {
      const due = toDate(s.due_date) || toDate(s.next_run_date);
      return due && due < now && !submittedScheduleIds.has(String(s.schedule_id));
    })
    .map(decorateSchedule)
    .sort((a, b) => b.daysLate - a.daysLate);

  const dueThisWeek = liveSchedules
    .filter((s) => {
      const due = toDate(s.due_date) || toDate(s.next_run_date);
      return due && due >= now && due <= new Date(now.getTime() + 7 * DAY) &&
        !submittedScheduleIds.has(String(s.schedule_id));
    })
    .map(decorateSchedule)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const dueSoFar = liveSchedules.filter((s) => {
    const due = toDate(s.due_date) || toDate(s.next_run_date);
    return due && due < now;
  });
  const adherence = share(
    dueSoFar.filter((s) => submittedScheduleIds.has(String(s.schedule_id))).length,
    dueSoFar.length
  );

  /* ------------------------------- coverage ----------------------------- */
  const scopedLocations = locations.filter((l) => !wantCluster || key(extractCluster(l)) === wantCluster);
  const auditedPods = new Set(submitted.map((a) => extractLocationId(a)).filter(Boolean));

  const uncoveredPods = scopedLocations
    .filter((l) => {
      const lid = extractLocationId(l);
      return lid && !auditedPods.has(lid);
    })
    .map((l) => ({
      pod: l['Store Name'] || l.pod_id || l['Location ID'] || '—',
      city: l.city || l.City || '—',
      cluster: extractCluster(l)
    }));

  const clustersWithAudits = new Set(submitted.map((a) => key(resolveCluster(a))).filter(Boolean));
  const uncoveredClusters = distinctValues(scopedLocations, 'cluster', 'Cluster', 'cluster_name', 'home_cluster', 'location_cluster')
    .filter((c) => !clustersWithAudits.has(key(c)));

  /* ------------------------------- auditors ----------------------------- */
  const auditorMap = new Map();

  users.forEach((u) => {
    const role = token(u.role);
    if (role === 'AUDITOR' || role === 'USER') {
      const e = norm(u.email);
      if (e && !auditorMap.has(key(e))) {
        auditorMap.set(key(e), {
          email: e,
          name: u.full_name || u.name || e,
          cluster: u.home_cluster || '—',
          active: norm(u.active) === '' ? true : parseBool(u.active),
          userId: u.user_id
        });
      }
    }
  });

  submitted.forEach((a) => {
    const e = norm(a.auditor_email || a.auditor_id);
    if (e && !auditorMap.has(key(e))) {
      auditorMap.set(key(e), {
        email: e,
        name: a.auditor_name || e,
        cluster: resolveCluster(a) || '—',
        active: true,
        userId: null
      });
    }
  });

  const pendingByAuditor = new Map();
  liveSchedules.forEach((s) => {
    if (submittedScheduleIds.has(String(s.schedule_id))) return;
    const k = key(s.assigned_auditor_email) || key(s.assigned_auditor);
    if (k) pendingByAuditor.set(k, (pendingByAuditor.get(k) || 0) + 1);
  });

  const byAuditor = [...auditorMap.values()].map((u) => {
    const mine = submitted.filter((a) => {
      const aEmail = extractAuditorEmail(a);
      return aEmail === key(u.email) || String(a.auditor_id) === String(u.userId);
    });
    const turnarounds = mine.map((a) => {
      const s = toDate(a.started_at), e = toDate(a.submitted_at);
      return s && e && e >= s ? (e - s) / 3600000 : null;
    }).filter((v) => v !== null);

    return {
      name: u.name,
      email: u.email,
      cluster: u.cluster,
      active: u.active,
      auditCount: mine.length,
      avgScore: mine.length
        ? round1(mine.reduce((s, a) => s + num(a.score_percent), 0) / mine.length)
        : 0,
      failures: mine.reduce((s, a) => s + num(a.failure_count), 0),
      critical: mine.reduce((s, a) => s + criticalCount(a), 0),
      avgTurnaroundHrs: turnarounds.length
        ? round1(turnarounds.reduce((s, v) => s + v, 0) / turnarounds.length)
        : 0,
      pending: pendingByAuditor.get(key(u.email)) || 0,
      lastLogin: u.lastLogin || ''
    };
  }).sort((a, b) => b.auditCount - a.auditCount);

  /* --------------------------- question insight ------------------------- */
  const failureRows = responses.filter((r) => parseBool(r.is_failure));

  const questionMap = new Map();
  responses.forEach((r) => {
    const qid = norm(r.question_id) || norm(r.question_text);
    if (!qid) return;
    if (!questionMap.has(qid)) {
      questionMap.set(qid, {
        question: norm(r.question_text) || qid,
        section: norm(r.section_name) || '—',
        risk: norm(r.risk_category) || 'General',
        critical: parseBool(r.critical_question),
        asked: 0, failed: 0
      });
    }
    const q = questionMap.get(qid);
    if (parseBool(r.is_na)) return;
    q.asked++;
    if (parseBool(r.is_failure)) q.failed++;
  });

  const topFailingQuestions = [...questionMap.values()]
    .filter((q) => q.failed > 0)
    .map((q) => ({ ...q, failRate: share(q.failed, q.asked) }))
    .sort((a, b) => b.failed - a.failed || b.failRate - a.failRate)
    .slice(0, 12);

  const riskMap = new Map();
  failureRows.forEach((r) => {
    const k = norm(r.risk_category) || 'General';
    riskMap.set(k, (riskMap.get(k) || 0) + 1);
  });
  const riskDistribution = [...riskMap.entries()]
    .map(([risk, count]) => ({ risk, count }))
    .sort((a, b) => b.count - a.count);

  const sectionMap = new Map();
  responses.forEach((r) => {
    const k = norm(r.section_name) || '—';
    if (!sectionMap.has(k)) sectionMap.set(k, { section: k, score: 0, max: 0, failed: 0 });
    const g = sectionMap.get(k);
    g.score += num(r.score);
    g.max += num(r.max_score);
    if (parseBool(r.is_failure)) g.failed++;
  });
  const bySection = [...sectionMap.values()]
    .map((g) => ({ section: g.section, avgScore: share(g.score, g.max), failed: g.failed }))
    .sort((a, b) => a.avgScore - b.avgScore);

  /* ------------------------------ breakdowns ---------------------------- */
  const statusMap = new Map();
  audits.forEach((a) => {
    const k = token(a.status) || 'UNKNOWN';
    statusMap.set(k, (statusMap.get(k) || 0) + 1);
  });
  const statusBreakdown = [...statusMap.entries()].map(([k, count]) => ({
    label: titleCase(k), count, color: STATUS_COLORS[k] || '#94a3b8'
  }));

  const scoreDistribution = SCORE_BUCKETS.map((b) => ({ range: b.range, color: b.color, count: 0 }));
  submitted.forEach((a) => {
    const p = num(a.score_percent);
    const i = SCORE_BUCKETS.findIndex((b) => p <= b.max);
    scoreDistribution[i === -1 ? SCORE_BUCKETS.length - 1 : i].count++;
  });

  const ratingMap = new Map();
  submitted.forEach((a) => {
    const k = norm(a.rating) || 'Unrated';
    ratingMap.set(k, (ratingMap.get(k) || 0) + 1);
  });

  const byCluster  = aggregate(submitted, (a) => resolveCluster(a), 'cluster');
  const byCity     = aggregate(submitted, (a) => a.city || a.City, 'city');
  const byTemplate = aggregate(submitted, (a) => extractTemplate(a), 'template');
  const byPod      = aggregate(submitted, (a) => extractLocationId(a), 'pod');

  const criticalAudits = submitted
    .filter((a) => criticalCount(a) > 0)
    .sort((a, b) => criticalCount(b) - criticalCount(a) ||
      (auditDate(b) || 0) - (auditDate(a) || 0))
    .slice(0, 10)
    .map((a) => ({
      audit_id: a.audit_id,
      template_name: extractTemplate(a) || '—',
      location_id: a.location_id || a.pod_id || a['Location ID'] || a['Store Name'] || '—',
      cluster: resolveCluster(a) || '—',
      auditor: a.auditor_name || a.auditor_email || '—',
      score_percent: num(a.score_percent),
      critical: criticalCount(a),
      failures: num(a.failure_count),
      submitted_at: a.submitted_at || ''
    }));

  const recentActivity = [...activityLog]
    .sort((x, y) => (toDate(y.created_at) || 0) - (toDate(x.created_at) || 0))
    .slice(0, 15)
    .map((l) => ({
      id: l.activity_id,
      who: l.user_id || 'SYSTEM',
      type: titleCase(l.activity_type),
      entity: l.entity_type || '',
      description: l.description || '',
      at: l.created_at || ''
    }));

  return {
    filters: { days, cluster: filters.cluster || '', template: filters.template || '', auditor: filters.auditor || '' },

    kpis: {
      totalAudits: audits.length,
      submittedCount: submitted.length,
      inProgressCount: inProgress.length,
      rejectedCount: rejected.length,
      passedCount: passed.length,
      failedCount: failed.length,
      passRate: share(passed.length, submitted.length),
      complianceScore: avgScore,
      totalFailures: submitted.reduce((s, a) => s + num(a.failure_count), 0),
      criticalFailures: submitted.reduce((s, a) => s + criticalCount(a), 0),
      openActionsCount: openActions.length,
      criticalOpenCount: criticalOpen.length,
      overdueActionsCount: overdueActions.length,
      unassignedActionsCount: unassignedOpen.length,
      avgResolutionDays,
      overdueSchedulesCount: overdueSchedules.length,
      dueThisWeekCount: dueThisWeek.length,
      scheduleAdherence: adherence,
      activeSchedules: liveSchedules.length,
      totalPods: scopedLocations.length,
      podsAudited: scopedLocations.length - uncoveredPods.length,
      coveragePercent: share(scopedLocations.length - uncoveredPods.length, scopedLocations.length),
      activeAuditors: byAuditor.filter((u) => u.active).length,
      contributingAuditors: byAuditor.filter((u) => u.auditCount > 0).length,
      idleAuditors: byAuditor.filter((u) => u.active && u.auditCount === 0).length,
      totalUsers: users.length
    },

    trend: buildTrend(submitted, since, now),
    statusBreakdown,
    passFail: [
      { label: 'Passed', count: passed.length, color: '#10b981' },
      { label: 'Failed', count: failed.length, color: '#ef4444' }
    ],
    scoreDistribution,
    ratingDistribution: [...ratingMap.entries()].map(([rating, count]) => ({ rating, count })),

    byCluster,
    byCity,
    byTemplate,
    bySection,
    topPods: byCluster.length ? byPod.slice(0, 10) : [],
    worstPods: [...byPod].sort((a, b) => a.avgScore - b.avgScore).slice(0, 10),
    byAuditor,

    riskDistribution,
    topFailingQuestions,
    criticalAudits,

    actions: {
      byPriority: actionsByPriority,
      ageBuckets,
      overdue: overdueActions.slice(0, 10).map((x) => ({
        action_id: x.action_id,
        title: x.title || x.question_text || '—',
        location_id: x.location_id || '—',
        priority: token(x.priority) || 'MEDIUM',
        owner: x.owner_email || 'Unassigned',
        due_date: x.due_date || '',
        daysLate: (() => {
          const d = toDate(x.due_date);
          return d ? Math.floor((now - d) / DAY) : 0;
        })()
      }))
    },

    schedules: { overdue: overdueSchedules.slice(0, 10), dueThisWeek: dueThisWeek.slice(0, 10) },
    coverage: { uncoveredPods: uncoveredPods.slice(0, 20), uncoveredClusters },
    recentActivity
  };
}

/** Flattens an array of objects to CSV and hands the browser a download. */
export function exportRowsToCsv(rows, filename) {
  if (!rows || !rows.length) return;

  const headers = [...rows.reduce((set, r) => {
    Object.keys(r).forEach((k) => set.add(k));
    return set;
  }, new Set())];

  const cell = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => cell(r[h])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}