import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import AppShell from '../components/AppShell';
import MyAuditsView from '../views/MyAuditsView';
import AuditHistoryView from '../views/AuditHistoryView';
import AuditRunnerView from '../views/AuditRunnerView';
import { NAV_CONFIG } from '../constants/navigation';
import AuditorCalendarView from '../views/AuditorCalendarView';
import AuditorDashboard from '../pages/AuditorDashboard';
import { supabase } from '../supabaseClient'; 

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
  const [runner, setRunner] = useState(null); 
  const [toast, setToast] = useState('');

  const fetchData = async () => {
    // Guard clause: Wait until user object is fully populated
    if (!currentUser?.email) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Fetch schedules safely using clean lowercased email string
      const userEmail = String(currentUser.email).trim();
      const userId = currentUser.user_id || currentUser.id;

      const [
        schedulesRes,
        auditsRes,
        templatesRes,
        sectionsRes,
        questionsRes,
        locationsRes
      ] = await Promise.all([
        supabase.from('schedules').select('*').ilike('assigned_auditor_email', userEmail),
        userId ? supabase.from('audits').select('*').eq('auditor_id', userId) : Promise.resolve({ data: [] }),
        supabase.from('templates').select('*'),
        supabase.from('sections').select('*'),
        supabase.from('question_bank').select('*'),
        supabase.from('locations').select('*')
      ]);

      if (schedulesRes.error) console.error("Schedules Fetch Error (400 check):", schedulesRes.error);
      if (auditsRes.error) console.error("Audits Fetch Error:", auditsRes.error);
      if (templatesRes.error) console.error("Templates Fetch Error:", templatesRes.error);
      if (sectionsRes.error) console.error("Sections Fetch Error:", sectionsRes.error);
      if (questionsRes.error) console.error("Questions Fetch Error:", questionsRes.error);

      const tList = templatesRes.data || [];
      const sList = sectionsRes.data || [];
      const qList = questionsRes.data || [];

      // 2. Stitch Templates -> Sections -> Questions
      const assembledTemplates = tList.map((tmpl) => {
        const tmplId = String(tmpl.template_id || tmpl.id || '');

        // Find sections for this template
        let tmplSections = sList
          .filter((s) => String(s.template_id) === tmplId)
          .sort((a, b) => (Number(a.section_order) || 0) - (Number(b.section_order) || 0));

        // Map questions to sections
        let sectionsWithQuestions = tmplSections.map((sec) => {
          const secId = String(sec.section_id || '');
          const secQuestions = qList
            .filter(
              (q) =>
                String(q.template_id) === tmplId &&
                (String(q.section_id) === secId || !q.section_id)
            )
            .sort((a, b) => (Number(a.question_order) || 0) - (Number(b.question_order) || 0));

          return {
            ...sec,
            questions: secQuestions
          };
        });

        // Fallback: If sections exist in question_bank but not in `sections` table
        if (sectionsWithQuestions.length === 0) {
          const tmplQuestions = qList
            .filter((q) => String(q.template_id) === tmplId)
            .sort((a, b) => (Number(a.question_order) || 0) - (Number(b.question_order) || 0));

          if (tmplQuestions.length > 0) {
            sectionsWithQuestions = [
              {
                section_id: 'sec-default',
                section_name: 'General Inspection',
                section_order: 1,
                questions: tmplQuestions
              }
            ];
          }
        }

        const totalQuestionsCount = sectionsWithQuestions.reduce(
          (acc, sec) => acc + (sec.questions?.length || 0),
          0
        );

        return {
          ...tmpl,
          sections: sectionsWithQuestions,
          questions_count: totalQuestionsCount
        };
      });

      setData({
        assignments: schedulesRes.data || [],
        audits: auditsRes.data || [],
        templates: assembledTemplates,
        locations: locationsRes.data || []
      });

    } catch (err) {
      console.error('Unhandled Supabase Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser?.email, currentUser?.user_id]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const enrichedAssignments = useMemo(() => {
    return data.assignments.map((assignment) => {
      // FIX: Filter matching audits, and prioritize SUBMITTED if duplicates exist
      const matchingAudits = data.audits.filter((a) => a.schedule_id === assignment.schedule_id);
      const isSubmitted = matchingAudits.some(a => a.status === 'SUBMITTED');
      
      return {
        ...assignment,
        audit_status: isSubmitted ? 'SUBMITTED' : (matchingAudits[0]?.status || 'SCHEDULED')
      };
    });
  }, [data.assignments, data.audits]);

  const counts = useMemo(
    () => ({
      pending: enrichedAssignments.filter((a) => a.audit_status !== 'SUBMITTED').length,
      submitted: enrichedAssignments.filter((a) => a.audit_status === 'SUBMITTED').length
    }),
    [enrichedAssignments]
  );

  const handleStartAudit = (assignment, template) => {
    const fullTemplate =
      data.templates.find(
        (t) => String(t.template_id) === String(assignment.template_id || template?.template_id)
      ) || template;

    setRunner({ assignment, template: fullTemplate });
    window.scrollTo({ top: 0 });
  };

  const handleExitRunner = (result = {}) => {
    setRunner(null);
    if (result.submitted) {
      setToast(
        `Audit submitted successfully${result.score !== undefined ? ` — score ${result.score}%` : ''}.`
      );
      fetchData(); 
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
            assignments={enrichedAssignments}
            templates={data.templates}
            currentUser={currentUser}
            onStartAudit={handleStartAudit}
            onRefreshData={fetchData}
          />
        ) : currentTab === 'Calendar' ? (
          <AuditorCalendarView
            assignments={enrichedAssignments}
            templates={data.templates}
            currentUser={currentUser}
            onStartAudit={handleStartAudit}
            onRefreshData={fetchData}
          />
        ) : (
          <AuditHistoryView
            audits={data.audits}
            templates={data.templates}
            locations={data.locations}
          />
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
