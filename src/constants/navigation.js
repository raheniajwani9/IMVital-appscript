import {LayoutGrid,Calendar,Users as UsersIcon,Tag,ClipboardCheck,History,CalendarDays,BarChart3} from 'lucide-react';

export const NAV_CONFIG = {
  ADMIN: {
    breadcrumb: 'PROGRAM ADMIN',
    defaultTab: 'Forms',
    groups: [
      {
        title: 'COMMAND CENTRE',
        items: [
          { key: 'Forms', name: 'Forms', icon: LayoutGrid, countKey: 'templates' },
          { key: 'Schedules', name: 'Schedules', icon: Calendar, countKey: 'schedules' }
        ]
      },
      {
        title: 'MANAGE',
        items: [
          { key: 'Users', name: 'User Console', icon: UsersIcon, countKey: 'users', mutedCount: true },
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
          { key: 'History', name: 'Submitted', icon: History, countKey: 'submitted', mutedCount: true }
        ]
      }
    ]
  }
};

const AUDITOR_ROLES = ['AUDITOR'];

const ADMIN_ROLES = ['ADMIN'];

export function resolveWorkspace(role) {
  const normalised = String(role || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

  if (AUDITOR_ROLES.includes(normalised)) return 'AUDITOR';
  if (ADMIN_ROLES.includes(normalised)) return 'ADMIN';
  return 'AUDITOR';
}

export function getNavConfig(role) {
  return NAV_CONFIG[resolveWorkspace(role)] || NAV_CONFIG.AUDITOR;
}
