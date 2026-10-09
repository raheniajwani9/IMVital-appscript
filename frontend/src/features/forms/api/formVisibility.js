const normalize = (value) => String(value ?? '').trim().toLowerCase();

export const visibilityFor = (rows = [], templateId) =>
  rows.find((row) => String(row.template_id) === String(templateId)) || null;

export const isFormVisible = (visibility, locationId) => {
  if (!visibility || visibility.mode === 'VISIBLE_ALL') return true;
  if (visibility.mode === 'HIDDEN_ALL') return false;
  return !(visibility.hidden_pod_ids || []).some((id) => normalize(id) === normalize(locationId));
};

export const visibilityLabel = (visibility) => {
  if (visibility?.mode === 'HIDDEN_ALL') return 'Hidden at all PODs';
  if (visibility?.mode === 'HIDDEN_SELECTED') {
    const count = visibility.hidden_pod_ids?.length || 0;
    return `Hidden at ${count} POD${count === 1 ? '' : 's'}`;
  }
  return 'Visible at all PODs';
};
