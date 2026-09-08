export const ROLE_OPTIONS = [
  {
    value: 'ADMIN',
    label: 'Admin'
  },
  {
    value: 'AUDITOR',
    label: 'Auditor'
  },
  {
    value: 'POD_LOCATION_OWNER',
    label: 'Pod/Location Owner'
  },
  {
    value: 'ACTION_OWNER',
    label: 'Action Owner'
  },
  {
    value: 'AUDIT_MANAGER',
    label: 'Audit Manager'
  },
  {
    value: 'CITY_CLUSTER_LEADER',
    label: 'City/Cluster Leader'
  }
];

const ROLE_LABELS = Object.fromEntries(
  ROLE_OPTIONS.map(({ value, label }) => [value, label])
);

export const getRoleLabel = (role) => {
  if (!role) {
    return 'Unassigned';
  }

  return (
    ROLE_LABELS[role] ||
    role
      .toString()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      )
  );
};
