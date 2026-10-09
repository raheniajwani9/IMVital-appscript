import React, { useState, useEffect, useMemo } from 'react';
import AppShell from '../../shared/layout/AppShell';
import FormsView from './views/FormsView';
import CategoriesView from './views/CategoriesView';
import UsersView from './views/UsersView';
import { NAV_CONFIG } from '../../shared/config/navigation';
import AdminDashboardView from './views/AdminDashboardView';
import { supabase } from '../../shared/lib/supabaseClient'; // Import local data store client

const DEFAULT_DATA = {
  overview: {
    complianceScore: '0%',
    auditCompletion: '0%',
    openActionsCount: 0,
    highRiskActionsCount: 0,
    syncHealth: '100%'
  },
  responses: [], 
  action_updates: [],
  evidence: [],
  activityLog: [],
  audits: [],
  actions: [],
  questionBank: [],
  sections: [], 
  templates: [],
  schedules: [],
  formVisibility: [],
  users: [],
  locations: [],
  clusters: []
};

export default function AdminWorkspace({ currentUser, onLogout }) {
  const [currentTab, setCurrentTab] = useState(NAV_CONFIG.ADMIN.defaultTab);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(DEFAULT_DATA);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all necessary tables in parallel for speed
      const [
        { data: templates },
        { data: sections }, 
        { data: questionBank },
        { data: schedules },
        { data: users },
        { data: audits },
        { data: responses }, 
        { data: actions },
        { data: locations },
        { data: formVisibility }
      ] = await Promise.all([
        supabase.from('templates').select('*'),
        supabase.from('sections').select('*'), 
        supabase.from('question_bank').select('*'),
        supabase.from('schedules').select('*'),
        supabase.from('users').select('*'),
        supabase.from('audits').select('*'),
        supabase.from('responses').select('*'), 
        supabase.from('actions').select('*'),
        // FIXED: Removed the .catch() - local data store safely returns data: null if this fails
        supabase.from('locations').select('*'),
        supabase.from('form_visibility').select('*')
      ]);

      setData({
        ...DEFAULT_DATA,
        templates: templates || [],
        sections: sections || [], 
        questionBank: questionBank || [],
        schedules: schedules || [],
        formVisibility: formVisibility || [],
        users: users || [],
        audits: audits || [],
        responses: responses || [], 
        actions: actions || [],
        locations: locations || []
      });
      setLoading(false);
    } catch (err) {
      console.error('local data store Fetch Error:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const counts = useMemo(
    () => ({
      templates: data.templates.length,
      schedules: data.schedules?.length || 0,
      users: data.users?.length || 0
    }),
    [data.templates, data.schedules, data.users]
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
      {currentTab === 'Dashboard' && (
        <AdminDashboardView data={data} loading={loading} onRefreshData={fetchData} />
      )}

      {currentTab === 'Forms' && (
        <FormsView 
          templates={data.templates} 
          sections={data.sections} 
          questions={data.questionBank} 
          schedules={data.schedules}
          formVisibility={data.formVisibility}
          locations={data.locations}
          users={data.users}
          currentUser={currentUser}
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
