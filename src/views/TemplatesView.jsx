import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Eye, MoreHorizontal, FileText, Pencil, Trash2, ChevronLeft, ChevronRight, Info, MapPin, User, Calendar, ShieldCheck } from 'lucide-react';
import CreateTemplateModal from '../components/createTemplateModal';
import UpdateTemplateModal from '../components/UpdateTemplateModal';
import DeleteTemplateModal from '../components/DeleteTemplateModal';

export default function TemplatesView({ data = [], onRefreshData }) {

  const groupedTemplates = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    if (data[0]?.sections) return data;

    const cleanData = data.filter((row) => {
      const id = String(row.template_id || row.template_code || '');
      const name = String(row.template_name || '');
      return !id.startsWith('CAT-') && name !== 'Category Metadata Entry';
    });

    const map = {};
    cleanData.forEach((row) => {
      const key = row.template_id || row.template_code || row.template_name;
      if (!key) return;

      if (!map[key]) {
        // Format ISO Date String cleanly (e.g. 2026-08-30)
        let formattedDate = row.effective_date || '';
        if (formattedDate && typeof formattedDate === 'string' && formattedDate.includes('T')) {
          formattedDate = formattedDate.split('T')[0];
        }

        map[key] = {
          template_id: key,
          template_code: row.template_code || key,
          template_name: row.template_name || row.section_name || 'Standard Checklist',
          template_category: row.template_category || row.category || 'Operations',
          template_description: row.template_description || '',
          template_instructions: row.template_instructions || row.instructions || '',
          audit_type: row.audit_type || 'Internal Audit',
          owner: row.template_owner_id || row.owner || 'System Admin',
          applicable_locations: row.applicable_locations || row.locations || 'All Locations',
          effective_date: formattedDate,
          template_status: row.template_status || 'Draft',
          template_version: row.template_version || 'v1.0',
          estimated_minutes: Number(row.estimated_minutes) || 15,
          sections: []
        };
      }

      const secName = row.section_name || 'General Inspection';
      let sec = map[key].sections.find((s) => s.section_name === secName);
      if (!sec) {
        sec = {
          section_name: secName,
          section_order: Number(row.section_order) || 1,
          questions: []
        };
        map[key].sections.push(sec);
      }

      const qText = row.question_text || row.help_text;
      if (qText) {
        sec.questions.push({
          question_id: row.question_id || `${key}-Q${sec.questions.length + 1}`,
          question_text: qText,
          response_type: row.response_type || 'YES_NO',
          evidence_policy: row.evidence_policy || 'NONE'
        });
      }
    });

    return Object.values(map);
  }, [data]);

  const [selectedId, setSelectedId] = useState(
    groupedTemplates[0]?.template_id || groupedTemplates[0]?.template_code || null
  );

  useEffect(() => {
    if (groupedTemplates.length > 0 && !selectedId) {
      setSelectedId(groupedTemplates[0].template_id);
    }
  }, [groupedTemplates, selectedId]);

  const [currentQuestionPage, setCurrentQuestionPage] = useState(1);
  const QUESTIONS_PER_PAGE = 1;

  const [activeMenuId, setActiveMenuId] = useState(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [deletingTemplate, setDeletingTemplate] = useState(null);

  useEffect(() => {
    setCurrentQuestionPage(1);
  }, [selectedId]);

  const toggleMenu = (e, id) => {
    e.stopPropagation();
    setActiveMenuId(activeMenuId === id ? null : id);
  };

  const handleEdit = (e, tmpl) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setEditingTemplate(tmpl);
  };

  const handleDelete = (e, tmpl) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setDeletingTemplate(tmpl);
  };

  const selectedTemplate =
    groupedTemplates.find(
      (item) => (item.template_id || item.template_code) === selectedId
    ) || groupedTemplates[0];

  const allTemplateQuestions = useMemo(() => {
    if (!selectedTemplate?.sections) return [];

    const list = [];
    selectedTemplate.sections.forEach((sec, sIdx) => {
      (sec.questions || []).forEach((q) => {
        list.push({
          ...q,
          section_name: sec.section_name,
          section_order: sec.section_order || sIdx + 1,
          display_order: list.length + 1
        });
      });
    });
    return list;
  }, [selectedTemplate]);

  const totalQuestionPages = Math.ceil(allTemplateQuestions.length / QUESTIONS_PER_PAGE) || 1;
  const qStartIndex = (currentQuestionPage - 1) * QUESTIONS_PER_PAGE;
  const paginatedQuestions = allTemplateQuestions.slice(
    qStartIndex,
    qStartIndex + QUESTIONS_PER_PAGE
  );

  return (
    <div
      className="min-h-screen bg-slate-50/50 p-6 font-sans text-slate-800"
      onClick={() => setActiveMenuId(null)}
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <span className="text-[11px] font-bold text-blue-600 tracking-wider uppercase">
            Configuration
          </span>
          <h1 className="text-3xl font-black text-slate-900 mt-1 tracking-tight">
            Build the standard.
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Create versioned checklists with conditional logic, evidence policies, and scoring — without engineering support.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
            <Eye className="w-4 h-4 text-slate-500" /> Preview
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-all"
          >
            <Plus className="w-4 h-4" /> New template
          </button>
        </div>
      </div>

      {groupedTemplates.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center space-y-3">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="text-sm font-bold text-slate-800">No Checklists Found</div>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            There are no operational templates stored in your database.
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
          >
            + Create First Standard
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-4">
            {groupedTemplates.map((tmpl) => {
              const itemId = tmpl.template_id || tmpl.template_code;
              const isSelected = selectedId === itemId || (!selectedId && groupedTemplates[0] === tmpl);
              const sectionsCount = tmpl.sections?.length || 0;
              const totalQuestions = tmpl.sections?.reduce((a, s) => a + (s.questions?.length || 0), 0) || 0;
              const isMenuOpen = activeMenuId === itemId;

              return (
                <div
                  key={itemId}
                  onClick={() => setSelectedId(itemId)}
                  className={`relative cursor-pointer p-6 rounded-2xl border transition-all flex items-start gap-4 ${
                    isSelected
                      ? 'bg-white border-blue-500 ring-2 ring-blue-500/10 shadow-md'
                      : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-6 h-6" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-base text-slate-900 truncate">
                        {tmpl.template_name}
                      </h3>

                      <div className="relative">
                        <button
                          onClick={(e) => toggleMenu(e, itemId)}
                          className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {isMenuOpen && (
                          <div className="absolute right-0 top-8 w-32 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-20">
                            <button
                              onClick={(e) => handleEdit(e, tmpl)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5 text-blue-600" /> Edit
                            </button>
                            <button
                              onClick={(e) => handleDelete(e, tmpl)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {tmpl.template_description || 'Standard operational procedure checklist.'}
                    </p>

                    <div className="flex items-center gap-3 mt-4 text-[11px]">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] flex items-center gap-1.5 ${
                          tmpl.template_status === 'Published'
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                            : 'bg-amber-50 text-amber-600 border border-amber-200/60'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${tmpl.template_status === 'Published' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {tmpl.template_status || 'Draft'}
                      </span>
                      <span className="text-slate-400 font-medium">
                        {sectionsCount} {sectionsCount === 1 ? 'section' : 'sections'}
                      </span>
                      <span className="text-slate-400 font-medium">
                        {totalQuestions} {totalQuestions === 1 ? 'question' : 'questions'}
                      </span>
                      <span className="text-slate-400 font-medium">
                        {tmpl.template_version || 'v1.0'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedTemplate && (
            <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm sticky top-6">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-blue-600 tracking-wider uppercase">
                    Template Preview
                  </span>
                  <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                    {selectedTemplate.template_name}
                  </h2>
                </div>
                <span
                  className={`px-3 py-1 rounded-full font-bold uppercase text-[10px] flex items-center gap-1.5 ${
                    selectedTemplate.template_status === 'Published'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                      : 'bg-amber-50 text-amber-600 border border-amber-200/60'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      selectedTemplate.template_status === 'Published' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  {selectedTemplate.template_status || 'Draft'}
                </span>
              </div>

              <div className="mt-4 divide-y divide-slate-100 text-xs">
                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-400 font-medium flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" /> Audit type
                  </span>
                  <span className="font-bold text-slate-800">
                    {selectedTemplate.audit_type || 'Internal Audit'}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-400 font-medium flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" /> Owner
                  </span>
                  <span className="font-bold text-slate-800">
                    {selectedTemplate.owner || 'N/A'}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-400 font-medium flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> Applicable locations
                  </span>
                  <span className="font-bold text-slate-800 truncate max-w-[160px]" title={selectedTemplate.applicable_locations}>
                    {selectedTemplate.applicable_locations || 'All Locations'}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-400 font-medium flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> Effective date
                  </span>
                  <span className="font-bold text-slate-800">
                    {selectedTemplate.effective_date || 'Immediate'}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Estimated duration</span>
                  <span className="font-bold text-slate-800">
                    {selectedTemplate.estimated_minutes ? `${selectedTemplate.estimated_minutes} min` : 'Unspecified'}
                  </span>
                </div>
              </div>

              <div className="mt-4 border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-3 min-h-[140px]">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200/60">
                  <span className="font-bold text-slate-800 truncate max-w-[200px]">
                    01 · {paginatedQuestions[0]?.section_name || selectedTemplate.sections?.[0]?.section_name || 'General Inspection'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium shrink-0">
                    {allTemplateQuestions.length} {allTemplateQuestions.length === 1 ? 'question' : 'questions'}
                  </span>
                </div>

                <div className="space-y-3">
                  {paginatedQuestions.length > 0 ? (
                    paginatedQuestions.map((q) => (
                      <div
                        key={q.question_id || q.display_order}
                        className="bg-white p-3 rounded-xl border border-slate-200/60 text-xs shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-slate-700 font-bold flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {q.display_order}
                            </span>
                            <span className="truncate" title={q.question_text}>
                              {q.question_text}
                            </span>
                          </span>
                          <span className="text-[9px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded uppercase shrink-0 ml-2">
                            {q.response_type || 'YES_NO'}
                          </span>
                        </div>

                        {selectedTemplate.template_instructions && (
                          <div className="ml-7 p-2.5 bg-slate-50 border border-slate-100 rounded-lg flex items-start gap-2">
                            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-slate-500 leading-normal font-medium">
                              {selectedTemplate.template_instructions}
                            </p>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-400 text-[11px] italic py-4 text-center">
                      No questions available in this template.
                    </div>
                  )}
                </div>
              </div>

              {totalQuestionPages > 1 && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] font-medium text-slate-400">
                    Question {qStartIndex + 1} of {allTemplateQuestions.length}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={currentQuestionPage === 1}
                      onClick={() => setCurrentQuestionPage((prev) => Math.max(prev - 1, 1))}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 text-slate-600 font-bold text-[11px]">
                      {currentQuestionPage} / {totalQuestionPages}
                    </span>
                    <button
                      disabled={currentQuestionPage === totalQuestionPages}
                      onClick={() => setCurrentQuestionPage((prev) => Math.min(prev + 1, totalQuestionPages))}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {isCreateOpen && (
        <CreateTemplateModal
          existingTemplates={groupedTemplates}
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            if (onRefreshData) onRefreshData();
          }}
        />
      )}

      {editingTemplate && (
        <UpdateTemplateModal
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onUpdated={() => {
            if (onRefreshData) onRefreshData();
          }}
        />
      )}

      {deletingTemplate && (
        <DeleteTemplateModal
          template={deletingTemplate}
          onClose={() => setDeletingTemplate(null)}
          onDeleted={() => {
            if (onRefreshData) onRefreshData();
          }}
        />
      )}
    </div>
  );
}