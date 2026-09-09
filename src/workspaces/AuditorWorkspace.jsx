import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import AppShell from '../components/AppShell';
import MyAuditsView from '../views/MyAuditsView';
import AuditHistoryView from '../views/AuditHistoryView';
import AuditRunnerView from '../views/AuditRunnerView';
import { NAV_CONFIG } from '../constants/navigation';
import AuditorCalendarView from '../views/AuditorCalendarView';
import AuditorDashboard from '../pages/AuditorDashboard';

const DEFAULT_DATA = {
  assignments: [],
  templates: [],
  audits: [],
  locations: []
};

export default function AuditorWorkspace({ currentUser, onLogout }) {
  const [currentTab, setCurrentTab] = useState(NAV_CONFIG.AUDITOR.defaultTab);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(DEFAULT_DATA);
  const [runner, setRunner] = useState(null); // { assignment, template }
  const [toast, setToast] = useState('');

  const fetchData = () => {
    setLoading(true);
    if (typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler((result) => {
          setData({ ...DEFAULT_DATA, ...result });
          setLoading(false);
        })
        .withFailureHandler((err) => {
          console.error('Apps Script Fetch Error:', err);
          setLoading(false);
        })
        // UPDATED: Now passing user_id to correctly match database rows
        .getAuditorData({ 
          email: currentUser.email, 
          name: currentUser.name,
          user_id: currentUser.user_id 
        });
    } else {
      setLoading(false);
    }
  };

  useEffect(fetchData, [currentUser.email, currentUser.user_id]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const counts = useMemo(
    () => ({
      pending: data.assignments.filter((a) => a.audit_status !== 'SUBMITTED').length,
      submitted: data.assignments.filter((a) => a.audit_status === 'SUBMITTED').length
    }),
    [data.assignments]
  );

  const handleStartAudit = (assignment, template) => {
    setRunner({ assignment, template });
    window.scrollTo({ top: 0 });
  };

  const handleExitRunner = (result = {}) => {
    setRunner(null);
    if (result.submitted) {
      setToast(
        `Audit submitted successfully${result.score !== undefined ? ` — score ${result.score}%` : ''}.`
      );
    }
    window.scrollTo({ top: 0 });
  };

  const breadcrumbTitle = runner
    ? runner.template?.template_name || runner.assignment.template_name
    : currentTab === 'Dashboard'
    ? 'Dashboard'
    : currentTab === 'MyAudits'
    ? 'My Audits'
    : currentTab === 'Calendar'
    ? 'Calendar'
    : 'Submitted';

  return (
    <>
      <AppShell
        currentUser={currentUser}
        navConfig={NAV_CONFIG.AUDITOR}
        currentTab={currentTab}
        onTabChange={(tab) => {
          setRunner(null);
          setCurrentTab(tab);
        }}
        counts={counts}
        breadcrumbTitle={breadcrumbTitle}
        loading={loading}
        loadingLabel="Loading your assignments..."
        onRefresh={fetchData}
        onLogout={onLogout}
      >
        {runner ? (
          <AuditRunnerView
            assignment={runner.assignment}
            template={runner.template}
            currentUser={currentUser}
            onExit={handleExitRunner}
            onRefreshData={fetchData}
          />
        ) : currentTab === 'Dashboard' ? (
          <AuditorDashboard
            currentUser={currentUser}
            onRefresh={fetchData}
          />
        ) : currentTab === 'MyAudits' ? (
          <MyAuditsView
            assignments={data.assignments}
            templates={data.templates}
            currentUser={currentUser}
            onStartAudit={handleStartAudit}
            onRefreshData={fetchData}
          />
        ) : currentTab === 'Calendar' ? (
          <AuditorCalendarView
            assignments={data.assignments}
            templates={data.templates}
            currentUser={currentUser}
            onStartAudit={handleStartAudit}
            onRefreshData={fetchData}
          />
        ) : (
          <AuditHistoryView audits={data.audits} />
        )}
      </AppShell>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{toast}</span>
          <button
            onClick={() => setToast('')}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
}
