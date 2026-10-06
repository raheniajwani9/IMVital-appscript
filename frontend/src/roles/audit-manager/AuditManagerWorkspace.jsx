import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  X,
  ShieldCheck,
  CalendarDays,
  ClipboardCheck,
  RotateCcw,
  LayoutDashboard,
  History,
  FileBarChart,
} from 'lucide-react';

import AppShell from '../../shared/layout/AppShell';
import AuditManagerView from './views/AuditManagerView';
import AuditManagerCalendarView from './views/AuditManagerCalendarView';
import { supabase } from '../../shared/lib/supabaseClient';
import ActionCenterView from './views/ActionCenterView';
import ReAuditView from './views/ReAuditView';
import AuditManagerDashboardView from './views/AuditManagerDashboardView';
import AuditManagerHistoryView from './views/AuditManagerHistoryView';
import AuditManagerReportsView from './views/AuditManagerReportsView';

const MANAGER_NAV_CONFIG = {
  breadcrumb: 'AUDIT MANAGER',
  defaultTab: 'Reviews',
  groups: [
    {
      title: 'REVIEW WORKSPACE',
      items: [
        {
          key: 'Dashboard',
          name: 'Dashboard',
          icon: LayoutDashboard
        },
        {
          key: 'Reviews',
          name: 'Reviews',
          icon: ShieldCheck
        },
        {
          key: 'Actions',
          name: 'Action Center',
          icon: ClipboardCheck
        },
        {
          key: 'ReAudits',
          name: 'Re-audits',
          icon: RotateCcw
        },
        {
          key: 'History',
          name: 'Audit History',
          icon: History
        },
        {
          key: 'Reports',
          name: 'Reports',
          icon: FileBarChart
        },
        {
          key: 'Calendar',
          name: 'Calendar',
          icon: CalendarDays
        }
      ]
    }
  ]
};

export default function AuditManagerWorkspace({
  currentUser,
  onLogout
}) {
  const [currentTab, setCurrentTab] = useState('Reviews');
  const [calendarAudits, setCalendarAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const fetchCalendarData = async () => {
    setLoading(true);

    try {
      const [
        auditsResult,
        schedulesResult,
        locationsResult
      ] = await Promise.all([
        supabase
          .from('audits')
          .select('*')
          .order('submitted_at', { ascending: false }),

        supabase
          .from('schedules')
          .select('*'),

        supabase
          .from('locations')
          .select('*')
      ]);

      if (auditsResult.error) {
        throw auditsResult.error;
      }

      const audits = auditsResult.data || [];
      const schedules = schedulesResult.data || [];
      const locations = locationsResult.data || [];

      const rows = audits.map((audit) => {
        const schedule = schedules.find(
          (item) => item.schedule_id === audit.schedule_id
        );

        const locationValue =
          audit.location_id ||
          schedule?.location_id ||
          schedule?.pod_id ||
          '';

        const location = locations.find((item) => {
          const possibleValues = [
            item.pod_id,
            item.location_id,
            item['Location ID'],
            item['Store Name']
          ]
            .filter(Boolean)
            .map((value) => String(value).toLowerCase());

          return possibleValues.includes(
            String(locationValue).toLowerCase()
          );
        });

        return {
          ...audit,

          template_name:
            audit.template_name ||
            schedule?.template_name ||
            audit.template_id ||
            'Untitled Audit',

          auditor_name:
            audit.auditor_name ||
            schedule?.assigned_auditor_name ||
            schedule?.auditor_name ||
            schedule?.assigned_auditor_email ||
            audit.auditor_email ||
            'Unknown Auditor',

          auditor_email:
            audit.auditor_email ||
            schedule?.assigned_auditor_email ||
            'N/A',

          location_id:
            locationValue ||
            location?.pod_id ||
            location?.location_id ||
            location?.['Location ID'] ||
            'All Locations',

          pod_name:
            location?.pod_id ||
            location?.location_id ||
            location?.['Location ID'] ||
            locationValue ||
            'N/A',

          due_date:
            audit.due_date ||
            schedule?.due_date ||
            schedule?.next_run_date,

          start_date:
            audit.start_date ||
            schedule?.start_date,

          audit_status:
            audit.status ||
            'SUBMITTED'
        };
      });

      setCalendarAudits(rows);
    } catch (error) {
      console.error('Audit Manager calendar error:', error);
      setToast(error.message || 'Failed to load calendar data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarData();
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast('');
    }, 5000);

    return () => clearTimeout(timer);
  }, [toast]);

  const counts = useMemo(() => ({
    pendingReviews: calendarAudits.filter((audit) => {
      const status = audit.review_status || 'PENDING_REVIEW';

      return [
        'PENDING_REVIEW',
        'REJECTED',
        'RE_AUDIT_REQUESTED'
      ].includes(status);
    }).length
  }), [calendarAudits]);

  return (
    <>
      <AppShell
        currentUser={currentUser}
        navConfig={MANAGER_NAV_CONFIG}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        counts={counts}
        breadcrumbTitle={
          currentTab
        }
        loading={loading}
        loadingLabel="Loading audit manager workspace..."
        onRefresh={fetchCalendarData}
        onLogout={onLogout}
      >
        {currentTab === 'Dashboard' ? (
          <AuditManagerDashboardView />
        ) : currentTab === 'Reviews' ? (
          <AuditManagerView
            currentUser={currentUser}
          />
        ) : currentTab === 'Actions' ? (
          <ActionCenterView
            currentUser={currentUser}
          />
        ) : currentTab === 'ReAudits' ? (
          <ReAuditView
            currentUser={currentUser}
          />
        ) : currentTab === 'History' ? (
          <AuditManagerHistoryView />
        ) : currentTab === 'Reports' ? (
          <AuditManagerReportsView />
        ) : (
          <AuditManagerCalendarView
            audits={calendarAudits}
            currentUser={currentUser}
            onRefresh={fetchCalendarData}
          />
        )}
      </AppShell>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white shadow-2xl">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />

          <span className="text-xs font-bold">
            {toast}
          </span>

          <button
            onClick={() => setToast('')}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
}
