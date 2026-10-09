import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import AppShell from '../../shared/layout/AppShell';
import MyAuditsView from './views/MyAuditsView';
import AuditHistoryView from './views/AuditHistoryView';
import AuditRunnerView from './views/AuditRunnerView';
import { NAV_CONFIG } from '../../shared/config/navigation';
import AuditorCalendarView from './views/AuditorCalendarView';
import AuditorDashboard from './views/AuditorDashboard';
import { supabase } from '../../shared/lib/supabaseClient'; 
import PodSelector from '../../shared/components/PodSelector';
import { podKey } from '../../shared/config/clusters';
import { isFormVisible, visibilityFor } from '../../features/forms/api/formVisibility';

const DEFAULT_DATA = {
  assignments: [],
  templates: [],
  audits: [],
  sections: [],
  questions: [],
  locations: [],
  formVisibility: []
};

export default function AuditorWorkspace({ currentUser, onLogout }) {
  const [currentTab, setCurrentTab] = useState(NAV_CONFIG.AUDITOR.defaultTab);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(DEFAULT_DATA);
  const [runner, setRunner] = useState(null); 
  const [toast, setToast] = useState('');
  const [pendingPanIndia, setPendingPanIndia] = useState(null);
  const [selectedPod, setSelectedPod] = useState({ location_id: 'All Locations', pod_id: '', city: '', cluster: '' });
  const [startingPanIndia, setStartingPanIndia] = useState(false);

  const fetchAssignments = async (email) => {
    const rows = [];
    for (let start = 0; ; start += 1000) {
      const { data: page, error } = await supabase.from('schedules').select('*')
        .ilike('assigned_auditor_email', email).range(start, start + 999);
      if (error) return { data: rows, error };
      rows.push(...(page || []));
      if ((page || []).length < 1000) return { data: rows, error: null };
    }
  };

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
        locationsRes,
        visibilityRes
      ] = await Promise.all([
        fetchAssignments(userEmail),
        userId ? supabase.from('audits').select('*').eq('auditor_id', userId) : Promise.resolve({ data: [] }),
        supabase.from('templates').select('*'),
        supabase.from('sections').select('*'),
        supabase.from('question_bank').select('*'),
        supabase.from('locations').select('*'),
        supabase.from('form_visibility').select('*')
      ]);

      if (schedulesRes.error) console.error("Schedules Fetch Error (400 check):", schedulesRes.error);
      if (auditsRes.error) console.error("Audits Fetch Error:", auditsRes.error);
      if (templatesRes.error) console.error("Templates Fetch Error:", templatesRes.error);
      if (sectionsRes.error) console.error("Sections Fetch Error:", sectionsRes.error);
      if (questionsRes.error) console.error("Questions Fetch Error:", questionsRes.error);
      if (visibilityRes.error) throw visibilityRes.error;

      const tList = templatesRes.data || [];
      const sList = sectionsRes.data || [];
      const qList = questionsRes.data || [];

      // 2. Stitch Templates -> Sections -> Questions
      const assembledTemplates = tList.map((tmpl) => {
        const tmplId = String(tmpl.template_id || tmpl.id || '');
        const currentVersionId = tmpl.current_version_id || null;

        // Find sections for this template
        let tmplSections = sList
          .filter((s) =>
            String(s.template_id) === tmplId &&
            (!currentVersionId || String(s.template_version_id) === String(currentVersionId))
          )
          .sort((a, b) => (Number(a.section_order) || 0) - (Number(b.section_order) || 0));

        // Map questions to sections
        let sectionsWithQuestions = tmplSections.map((sec) => {
          const secId = String(sec.section_id || '');
          const secQuestions = qList
            .filter(
              (q) =>
                String(q.template_id) === tmplId &&
                (!currentVersionId || String(q.template_version_id) === String(currentVersionId)) &&
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
            .filter((q) =>
              String(q.template_id) === tmplId &&
              (!currentVersionId || String(q.template_version_id) === String(currentVersionId))
            )
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
        sections: sList,
        questions: qList,
        locations: locationsRes.data || [],
        formVisibility: visibilityRes.data || []
      });

    } catch (err) {
      console.error('Unhandled local data store Fetch Error:', err);
      setData(DEFAULT_DATA);
      setToast('Could not verify form visibility. Reload when the connection is available.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser?.email, currentUser?.user_id]);

  useEffect(() => {
    if (!currentUser?.email) return undefined;
    const refreshVisibility = async () => {
      const { data: rows, error } = await supabase.from('form_visibility').select('*');
      if (!error) setData((previous) => ({ ...previous, formVisibility: rows || [] }));
    };
    const timer = setInterval(refreshVisibility, 5000);
    return () => clearInterval(timer);
  }, [currentUser?.email]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const enrichedAssignments = useMemo(() => {
    const enriched = data.assignments.map((assignment) => {
      const matchingAudits = data.audits
        .filter((audit) => audit.schedule_id === assignment.schedule_id)
        .sort((a, b) => new Date(b.submitted_at || b.started_at || b.created_at || 0) - new Date(a.submitted_at || a.started_at || a.created_at || 0));
      const linkedAudit = matchingAudits[0];
      return {
        ...assignment,
        open_audit_id: linkedAudit?.audit_id || assignment.open_audit_id,
        open_audit_version_id: linkedAudit?.template_version_id || assignment.open_audit_version_id,
        open_audit_version_label: linkedAudit?.template_version || assignment.open_audit_version_label,
        audit_id: assignment.audit_id || linkedAudit?.audit_id,
        audit_status: linkedAudit?.status || 'SCHEDULED',
        linked_audit_location_id: linkedAudit?.location_id,
        linked_audit_city: linkedAudit?.city,
        linked_audit_cluster: linkedAudit?.cluster
      };
    });
    const byTemplate = new Map();
    enriched.forEach((assignment) => {
      const key = String(assignment.template_id);
      if (!byTemplate.has(key)) byTemplate.set(key, []);
      byTemplate.get(key).push(assignment);
    });

    const visible = [];
    for (const rows of byTemplate.values()) {
      const published = rows.filter((row) => String(row.schedule_id || '').startsWith('PUB-'));
      const allLocationRows = published.filter((row) => row.location_id === 'All Locations');
      const concreteRows = published.filter((row) => row.location_id && row.location_id !== 'All Locations');
      const uniqueLocations = new Set(concreteRows.map((row) => String(row.location_id).toLowerCase()));
      const legacyPanIndia = data.locations.length >= 20 && uniqueLocations.size >= data.locations.length * 0.9;

      if (allLocationRows.length || legacyPanIndia) {
        const candidates = allLocationRows.length ? allLocationRows : concreteRows;
        const active = candidates
          .filter((row) => row.audit_status !== 'SUBMITTED')
          .sort((a, b) => (a.audit_status === 'IN_PROGRESS' ? -1 : 0) - (b.audit_status === 'IN_PROGRESS' ? -1 : 0) ||
            new Date(b.created_at || 0) - new Date(a.created_at || 0));
        const representative = active[0] || candidates[0];
        const needsNewRun = !active.length && representative.audit_status === 'SUBMITTED';
        visible.push({
          ...representative,
          audit_status: needsNewRun ? 'SCHEDULED' : representative.audit_status,
          open_audit_id: needsNewRun ? null : representative.open_audit_id,
          audit_id: needsNewRun ? null : representative.audit_id,
          location_id: representative.audit_status === 'IN_PROGRESS'
            ? (representative.linked_audit_location_id || representative.location_id)
            : 'All Locations',
          city: representative.audit_status === 'IN_PROGRESS'
            ? (representative.linked_audit_city || representative.city)
            : representative.city,
          cluster: representative.audit_status === 'IN_PROGRESS'
            ? representative.linked_audit_cluster
            : representative.cluster,
          pan_india_candidates: legacyPanIndia && !allLocationRows.length ? concreteRows : null,
          pan_india_needs_schedule: needsNewRun,
          pan_india: true
        });
        visible.push(...rows.filter((row) => !published.includes(row) ||
          (!legacyPanIndia && row.location_id !== 'All Locations')));
      } else {
        visible.push(...rows);
      }
    }
    return visible.flatMap((assignment) => {
      const visibility = visibilityFor(data.formVisibility, assignment.template_id);
      if (assignment.pan_india && assignment.audit_status !== 'IN_PROGRESS') {
        return data.locations.some((location) => isFormVisible(visibility, podKey(location)))
          ? [assignment] : [];
      }
      if (isFormVisible(visibility, assignment.linked_audit_location_id || assignment.location_id)) {
        return [assignment];
      }
      if (assignment.pan_india && data.locations.some((location) => isFormVisible(visibility, podKey(location)))) {
        return [{ ...assignment, audit_status: 'SCHEDULED', open_audit_id: null, audit_id: null,
          location_id: 'All Locations', linked_audit_location_id: null, pan_india_needs_schedule: true }];
      }
      return [];
    });
  }, [data.assignments, data.audits, data.locations, data.formVisibility]);

  useEffect(() => {
    if (!runner) return undefined;
    let cancelled = false;
    const onOffline = () => {
      setRunner(null);
      setToast('Connection lost. This audit is blocked until visibility can be checked again.');
    };
    window.addEventListener('offline', onOffline);
    const checkVisibility = async () => {
      const { data: visibility, error } = await supabase.from('form_visibility')
        .select('mode, hidden_pod_ids')
        .eq('template_id', runner.template.template_id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setRunner(null);
        setToast('Could not verify form visibility. This audit is blocked until the connection is restored.');
        return;
      }
      if (!isFormVisible(visibility, runner.assignment.location_id)) {
        setRunner(null);
        setToast('This form was hidden for this POD. Your audit has been blocked.');
        fetchData();
      }
    };
    checkVisibility();
    const timer = setInterval(checkVisibility, 5000);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener('offline', onOffline); };
  }, [runner]);

  const counts = useMemo(
    () => ({
      pending: enrichedAssignments.filter((a) => a.audit_status !== 'SUBMITTED').length,
      submitted: enrichedAssignments.filter((a) => a.audit_status === 'SUBMITTED').length
    }),
    [enrichedAssignments]
  );

  const launchAudit = (assignment, template) => {
    const fullTemplate = data.templates.find(
      (t) => String(t.template_id) === String(assignment.template_id || template?.template_id)
    ) || template;
    const versionId = assignment.open_audit_version_id || fullTemplate?.current_version_id || null;
    const versionSections = data.sections
      .filter((section) =>
        String(section.template_id) === String(fullTemplate?.template_id) &&
        (!versionId || String(section.template_version_id) === String(versionId))
      )
      .sort((a, b) => (Number(a.section_order) || 0) - (Number(b.section_order) || 0))
      .map((section) => ({
        ...section,
        questions: data.questions
          .filter((question) =>
            String(question.template_id) === String(fullTemplate?.template_id) &&
            String(question.section_id) === String(section.section_id) &&
            (!versionId || String(question.template_version_id) === String(versionId))
          )
          .sort((a, b) => (Number(a.question_order) || 0) - (Number(b.question_order) || 0))
      }));

    const versionTemplate = {
      ...fullTemplate,
      template_version_id: versionId,
      template_version: assignment.open_audit_version_label || fullTemplate?.template_version,
      sections: versionSections,
      questions_count: versionSections.reduce(
        (total, section) => total + (section.questions?.length || 0), 0
      )
    };

    setRunner({
      assignment: { ...assignment, template_version_id: versionId },
      template: versionTemplate
    });
    window.scrollTo({ top: 0 });
  };

  const handleStartAudit = async (assignment, template) => {
    const { data: visibility, error } = await supabase.from('form_visibility')
      .select('mode, hidden_pod_ids').eq('template_id', assignment.template_id).maybeSingle();
    if (error) { setToast(error.message || 'Could not check form visibility.'); return; }
    if (assignment.pan_india && !data.locations.some((location) => isFormVisible(visibility, podKey(location)))) {
      setToast('This form is hidden at all available PODs.');
      return;
    }
    if (assignment.pan_india && assignment.audit_status === 'IN_PROGRESS' &&
        !isFormVisible(visibility, assignment.linked_audit_location_id || assignment.location_id)) {
      setToast('This form is hidden for this POD.');
      return;
    }
    if (!assignment.pan_india && !isFormVisible(visibility, assignment.linked_audit_location_id || assignment.location_id)) {
      setToast('This form is hidden for this POD.');
      return;
    }
    if (assignment.pan_india && assignment.audit_status !== 'IN_PROGRESS') {
      setSelectedPod({ location_id: 'All Locations', pod_id: '', city: '', cluster: '' });
      setPendingPanIndia({ assignment, template });
      return;
    }
    launchAudit(assignment, template);
  };

  const startPanIndiaAudit = async () => {
    if (!selectedPod.location_id || selectedPod.location_id === 'All Locations') {
      setToast('Select a POD before starting the audit.');
      return;
    }
    setStartingPanIndia(true);
    try {
      const { assignment, template } = pendingPanIndia;
      const { data: visibility, error: visibilityError } = await supabase.from('form_visibility')
        .select('mode, hidden_pod_ids').eq('template_id', assignment.template_id).maybeSingle();
      if (visibilityError) throw visibilityError;
      if (!isFormVisible(visibility, selectedPod.location_id)) {
        throw new Error('This form is hidden for the selected POD.');
      }
      let selectedAssignment = assignment;
      if (assignment.pan_india_candidates) {
        const pod = data.locations.find((location) => String(podKey(location)) === String(selectedPod.location_id));
        const locationIds = new Set([
          selectedPod.location_id, pod?.location_id, pod?.pod_id, pod?.['Location ID']
        ].filter(Boolean).map(String));
        const matches = assignment.pan_india_candidates
          .filter((row) => locationIds.has(String(row.location_id)) && row.audit_status !== 'SUBMITTED')
          .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        selectedAssignment = matches[0] || null;
      }
      if (!selectedAssignment || assignment.pan_india_needs_schedule) {
        const createdAt = new Date().toISOString();
        const nextAssignment = {
          schedule_id: `PUB-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          template_id: assignment.template_id,
          location_id: assignment.pan_india_candidates ? selectedPod.location_id : 'All Locations',
          city: assignment.pan_india_candidates ? selectedPod.city : '',
          frequency: assignment.frequency || 'ONE_TIME',
          run_date: createdAt.slice(0, 10),
          due_date: null,
          assigned_auditor: assignment.assigned_auditor,
          assigned_auditor_email: assignment.assigned_auditor_email,
          priority: assignment.priority || 'MEDIUM',
          created_at: createdAt
        };
        const { error } = await supabase.from('schedules').insert(nextAssignment);
        if (error) throw error;
        selectedAssignment = nextAssignment;
      }
      setPendingPanIndia(null);
      launchAudit({ ...selectedAssignment, ...selectedPod, open_audit_id: null, audit_id: null }, template);
    } catch (error) {
      setToast(error.message || 'Could not start this audit.');
    } finally {
      setStartingPanIndia(false);
    }
  };

  const handleExitRunner = (result = {}) => {
    setRunner(null);
    if (result.submitted) {
      setToast(
        `Audit submitted successfully${result.score !== undefined ? ` — score ${result.score}%` : ''}.`
      );
    }
    fetchData();
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
            audits={data.audits}
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

      {pendingPanIndia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">Choose a POD for this audit</h2>
            <p className="mt-1 mb-4 text-sm text-slate-500">This Pan India form is available across all locations.</p>
            <PodSelector locations={data.locations.filter((location) =>
              isFormVisible(visibilityFor(data.formVisibility, pendingPanIndia.assignment.template_id), podKey(location))
            )} {...selectedPod} onChange={setSelectedPod} allowAll={false} />
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setPendingPanIndia(null)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
              <button type="button" onClick={startPanIndiaAudit} disabled={startingPanIndia} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{startingPanIndia ? 'Starting...' : 'Start Audit'}</button>
            </div>
          </div>
        </div>
      )}

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
