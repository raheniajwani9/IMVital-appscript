import React, { useState, useEffect, useMemo } from 'react';
import AppShell from '../components/AppShell';
import FormsView from '../views/FormsView';
import SchedulesView from '../views/SchedulesView';
import CategoriesView from '../views/CategoriesView';
import UsersView from '../views/UsersView';
import { NAV_CONFIG } from '../constants/navigation';

const DEFAULT_DATA = {
  overview: {
    complianceScore: '0%',
    auditCompletion: '0%',
    openActionsCount: 0,
    highRiskActionsCount: 0,
    syncHealth: '100%'
  },
  audits: [],
  actions: [],
  questionBank: [],
  templates: [],
  schedules: [],
  users: [],
  locations: [],
  clusters: []
};

export default function AdminWorkspace({ currentUser, onLogout }) {
  const [currentTab, setCurrentTab] = useState(NAV_CONFIG.ADMIN.defaultTab);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(DEFAULT_DATA);

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
        .getProgramAdminData();
    } else {
      setLoading(false);
    }
  };

  useEffect(fetchData, []);

  const templates = data.templates.length > 0 ? data.templates : data.questionBank;

  const counts = useMemo(
    () => ({
      templates: templates.length,
      schedules: data.schedules?.length || 0,
      users: data.users?.length || 0
    }),
    [templates, data.schedules, data.users]
  );

  return (
    <AppShell
      currentUser={currentUser}
      navConfig={NAV_CONFIG.ADMIN}
      currentTab={currentTab}
      onTabChange={setCurrentTab}
      counts={counts}
      loading={loading}
      onRefresh={fetchData}
      onLogout={onLogout}
    >
      {currentTab === 'Forms' && <FormsView data={templates} onRefreshData={fetchData} />}

      {currentTab === 'Schedules' && (
        <SchedulesView
          schedules={data.schedules}
          templates={templates}
          locations={data.locations}
          users={data.users}
          onRefreshData={fetchData}
        />
      )}

      {currentTab === 'Categories' && (
        <CategoriesView questionBank={data.questionBank} onRefreshData={fetchData} />
      )}

      {currentTab === 'Users' && (
        <UsersView
          users={data?.users || []}
          locations={data?.locations || []}
          onRefreshData={fetchData}
        />
      )}
    </AppShell>
  );
}
