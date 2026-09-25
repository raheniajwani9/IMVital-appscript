import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell';
import ActionOwnerDashboardView from '../views/ActionOwnerDashboardView';
import ActionOwnerView from '../views/ActionOwnerView';
import { NAV_CONFIG } from '../constants/navigation';
import { supabase } from '../supabaseClient';

const normalize = (value) => String(value || '').trim().toUpperCase();

export default function ActionOwnerWorkspace({ currentUser, onLogout }) {
  const [currentTab, setCurrentTab] = useState('Dashboard');
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadOwnerData = useCallback(async () => {
    const email = String(currentUser?.email || '').trim();

    if (!email) {
      setActions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');

    const { data: actionRows, error: actionError } = await supabase
      .from('actions')
      .select('*')
      .ilike('owner_email', email)
      .order('created_at', { ascending: false });

    if (actionError) {
      setLoadError(actionError.message);
      setActions([]);
      setLoading(false);
      return;
    }

    const ownerActions = actionRows || [];
    const auditIds = [...new Set(ownerActions.map((action) => action.audit_id).filter(Boolean))];
    let audits = [];

    if (auditIds.length) {
      const { data: auditRows, error: auditError } = await supabase
        .from('audits')
        .select('*')
        .in('audit_id', auditIds);

      if (auditError) {
        console.error('Could not load audit names for dashboard:', auditError);
      } else {
        audits = auditRows || [];
      }
    }

    const enrichedActions = ownerActions.map((action) => {
      const audit = audits.find((item) => String(item.audit_id) === String(action.audit_id)) || {};
      return {
        ...action,
        display_audit_name:
          audit.audit_name || audit.template_name || audit.form_name || 'Audit'
      };
    });

    setActions(enrichedActions);

    setLoading(false);
  }, [currentUser?.email]);

  useEffect(() => {
    loadOwnerData();
  }, [loadOwnerData]);

  const counts = useMemo(() => ({
    total: actions.length,
    pendingVerification: actions.filter(
      (action) => normalize(action.status) === 'PENDING_VERIFICATION'
    ).length,
    completed: actions.filter((action) =>
      ['VERIFIED', 'CLOSED'].includes(normalize(action.status))
    ).length
  }), [actions]);

  if (loading) {
    return <div className="p-8 text-sm font-semibold text-slate-500">Loading your action workspace…</div>;
  }

  const statusScope = {
    Actions: 'ALL',
    Verification: 'PENDING_VERIFICATION',
    Completed: ['VERIFIED', 'CLOSED']
  }[currentTab];

  return (
    <AppShell
      currentUser={currentUser}
      navConfig={NAV_CONFIG.ACTION_OWNER}
      currentTab={currentTab}
      onTabChange={setCurrentTab}
      counts={counts}
      breadcrumbTitle={currentTab}
      loading={false}
      onRefresh={loadOwnerData}
      onLogout={onLogout}
    >
      {loadError && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {loadError}
        </div>
      )}

      {currentTab === 'Dashboard' ? (
        <ActionOwnerDashboardView
          actions={actions}
          onOpenActions={() => setCurrentTab('Actions')}
        />
      ) : (
        <ActionOwnerView
          key={currentTab}
          currentUser={currentUser}
          statusScope={statusScope || 'ALL'}
          viewTitle={{
            Actions: 'My Actions',
            Verification: 'Awaiting Verification',
            Completed: 'Completed Actions'
          }[currentTab] || 'My Actions'}
          onRefresh={loadOwnerData}
        />
      )}
    </AppShell>
  );
}
