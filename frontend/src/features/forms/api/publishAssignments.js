import { podLabel } from '../../../shared/config/clusters';

const assignmentKey = (email, locationId) =>
  `${String(email || '').trim().toLowerCase()}|${String(locationId || '').trim().toLowerCase()}`;

export async function publishAssignments({
  supabase,
  templateId,
  publishScope,
  locations,
  auditors,
  selectedAuditor,
  selectedPods
}) {
  const targetAuditors = publishScope === 'PAN_INDIA' ? auditors : [selectedAuditor];
  const targetPods = publishScope === 'PAN_INDIA'
    ? [{ location_id: 'All Locations' }]
    : selectedPods;

  if (!targetAuditors.length || !targetPods.length || targetAuditors.some((auditor) => !auditor?.email)) {
    throw new Error('Select an auditor and at least one location before publishing.');
  }

  const existingKeys = new Set();
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase
      .from('schedules')
      .select('assigned_auditor_email, location_id')
      .eq('template_id', templateId)
      .range(start, start + 999);
    if (error) throw error;
    (data || []).forEach((row) => existingKeys.add(assignmentKey(row.assigned_auditor_email, row.location_id)));
    if ((data || []).length < 1000) break;
  }

  const createdAt = new Date().toISOString();
  const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const assignments = [];
  for (const auditor of targetAuditors) {
    for (const pod of targetPods) {
      const locationId = pod.location_id || pod.pod_id || podLabel(pod) || 'All Locations';
      const key = assignmentKey(auditor.email, locationId);
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      assignments.push({
        schedule_id: `PUB-${batchId}-${assignments.length}`,
        template_id: templateId,
        location_id: locationId,
        city: pod.city || pod.City || pod.city_name || pod['City Name'] || '',
        frequency: 'ONE_TIME',
        run_date: createdAt.slice(0, 10),
        due_date: null,
        assigned_auditor: auditor.full_name || auditor.name || auditor.email,
        assigned_auditor_email: auditor.email,
        priority: 'MEDIUM',
        created_at: createdAt
      });
    }
  }

  for (let start = 0; start < assignments.length; start += 500) {
    const { error } = await supabase.from('schedules').insert(assignments.slice(start, start + 500));
    if (error) throw error;
  }
  return assignments.length;
}
