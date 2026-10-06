import {
  LayoutGrid,
  Calendar,
  Users as UsersIcon,
  Tag,
  ClipboardCheck,
  History,
  BarChart3,
  CheckCircle2,
  Clock3,
} from 'lucide-react';

export const NAV_CONFIG = {
  ADMIN: {
    breadcrumb: 'PROGRAM ADMIN',
    defaultTab: 'Dashboard',
    groups: [
      {
        title: 'COMMAND CENTRE',
        items: [
          { key: 'Dashboard', name: 'Dashboard', icon: BarChart3 },
          { key: 'Forms', name: 'Forms', icon: LayoutGrid, countKey: 'templates' },
          { key: 'Schedules', name: 'Schedules', icon: Calendar, countKey: 'schedules' }
        ]
      },
      {
        title: 'MANAGE',
        items: [
          { key: 'Users', name: 'User Console', icon: UsersIcon, countKey: 'users' },
          { key: 'Categories', name: 'Categories', icon: Tag }
        ]
      }
    ]
  },

  AUDITOR: {
    breadcrumb: 'AUDITOR',
    defaultTab: 'Dashboard',
    groups: [
      {
        title: 'MY WORKSPACE',
        items: [
          { key: 'Dashboard', name: 'Dashboard', icon: BarChart3 },
          { key: 'MyAudits', name: 'My Audits', icon: ClipboardCheck, countKey: 'pending' },
          { key: 'Calendar', name: 'Calendar', icon: Calendar },
          { key: 'History', name: 'Submitted', icon: History, countKey: 'submitted' }
        ]
      }
    ]
  },

  ACTION_OWNER: {
    breadcrumb: 'ACTION OWNER',
    defaultTab: 'Dashboard',
    groups: [
      {
        title: 'MY WORK',
        items: [
          { key: 'Dashboard', name: 'Dashboard', icon: BarChart3 },
          { key: 'Actions', name: 'My Actions', icon: ClipboardCheck, countKey: 'total' },
          { key: 'Verification', name: 'Awaiting Verification', icon: Clock3, countKey: 'pendingVerification' },
          { key: 'Completed', name: 'Completed', icon: CheckCircle2, countKey: 'completed' }
        ]
      }
    ]
  }
};

const AUDITOR_ROLES = ['AUDITOR', 'AUDIT_MANAGER'];
const ADMIN_ROLES = ['ADMIN'];
const ACTION_OWNER_ROLES = ['ACTION_OWNER'];

export function resolveWorkspace(role) {
  const normalized = String(role || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

  if (ADMIN_ROLES.includes(normalized)) return 'ADMIN';
  if (AUDITOR_ROLES.includes(normalized)) return 'AUDITOR';
  if (ACTION_OWNER_ROLES.includes(normalized)) return 'ACTION_OWNER';

  return 'AUDITOR';
}

export function getNavConfig(role) {
  return NAV_CONFIG[resolveWorkspace(role)] || NAV_CONFIG.AUDITOR;
}
