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

/**
 * The sheet stores roles as "Auditor" / "Admin" / "City/Cluster Leader".
 * Maps any of those onto a real ROLE_OPTIONS value so <select> matches — without
 * this, editing a user silently reassigns them to the first option.
 */
export const normalizeRole = (role) => {
  const raw = String(role || '').trim();
  if (!raw) return 'AUDITOR';

  const token = raw.toUpperCase().replace(/[\s/\-]+/g, '_');
  if (ROLE_LABELS[token]) return token;

  const byLabel = ROLE_OPTIONS.find(
    (option) => option.label.toLowerCase() === raw.toLowerCase()
  );

  return byLabel ? byLabel.value : token;
};
