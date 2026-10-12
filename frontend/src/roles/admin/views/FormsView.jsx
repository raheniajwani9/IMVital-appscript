import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, MoreHorizontal, FileText, Pencil, Trash2, ChevronLeft, ChevronRight,
  User, Clock, X, Search, ChevronDown, ArrowDownAZ, ArrowUpAZ,
  Check, AlertTriangle
} from 'lucide-react';
import CreateFormModal from '../../../features/forms/components/CreateFormModal';
import FormVisibilityModal from '../../../features/forms/components/FormVisibilityModal';
import { visibilityFor, visibilityLabel } from '../../../features/forms/api/formVisibility';
import UpdateFormModal from '../../../features/forms/components/UpdateFormModal';
import DeleteFormModal from '../../../features/forms/components/DeleteFormModal';
import AssignFormAuditorsModal from '../../../features/forms/components/AssignFormAuditorsModal';

// UPDATED: Now accepts templates, sections, and questions as separate arrays
export default function FormsView({ templates = [], sections = [], questions = [], formVisibility = [], locations = [], users = [], data = [], currentUser, onRefreshData }) {

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  const SORT_OPTIONS = [
    { value: 'latest', label: 'Latest First', icon: Clock },
    { value: 'oldest', label: 'Oldest First', icon: Clock },
    { value: 'az', label: 'A → Z', icon: ArrowDownAZ },
    { value: 'za', label: 'Z → A', icon: ArrowUpAZ },
  ];

  const userName = (actor) => {
    const value = String(actor || '').trim();
    if (!value) return 'Unknown user';

    const user = users.find((u) =>
      [u.user_id, u.auth_user_id, u.id, u.email]
        .some((key) => String(key || '').toLowerCase() === value.toLowerCase())
    );

    if (user) return user.full_name || user.name || user.email || 'Unknown user';

    const looksLikeId = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value) || /^USR-[a-z0-9-]+$/i.test(value);
    return looksLikeId ? 'Unknown user' : value;
  };

  // 1. RELATIONAL DATA MAPPING (Stitching local data store tables together)
  const groupedForms = useMemo(() => {
    // Fallback if data is passed as a single object from AdminWorkspace
    const tList = templates.length > 0 ? templates : (data.templates || data || []);
    const sList = sections.length > 0 ? sections : (data.sections || []);
    const qList = questions.length > 0 ? questions : (data.question_bank || data.questions || []);

    if (!Array.isArray(tList) || tList.length === 0) return [];

    const map = {};

    // A. Map Templates
    tList.forEach((t) => {
      if (!t.template_id || t.template_name === 'Category Metadata Entry') return;
      
      let formattedDate = t.effective_date || '';
      if (formattedDate && typeof formattedDate === 'string' && formattedDate.includes('T')) {
        formattedDate = formattedDate.split('T')[0];
      }

      map[t.template_id] = {
        template_id: t.template_id,
        template_code: t.template_code || t.template_id,
        template_name: t.template_name || 'Untitled Form',
        template_category: t.template_category || 'Operations',
        template_description: t.template_description || '',
        template_instructions: t.template_instructions || '',
        audit_type: t.audit_type || 'Internal Audit',
        created_by: t.created_by || 'Unknown', 
        last_edited_by: t.last_edited_by || 'Unknown',
        effective_date: formattedDate,
        template_status: 'Published',
        template_version: t.template_version || 'v1.0',
        current_version_id: t.current_version_id || null,
        estimated_minutes: Number(t.estimated_minutes) || 15,
        sections: []
      };
    });

    // B. Attach Sections to Templates
    sList.forEach((s) => {
      const parentForm = map[s.template_id];
      if (parentForm && (!parentForm.current_version_id || s.template_version_id === parentForm.current_version_id)) {
        parentForm.sections.push({
          section_id: s.section_id,
          section_name: s.section_name || 'General Inspection',
          section_category: s.section_category || '',
          section_weight: s.section_weight,
          section_order: Number(s.section_order) || parentForm.sections.length + 1,
          section_instructions: s.section_instructions || '',
          questions: []
        });
      }
    });

    // C. Attach Questions to Sections
    qList.forEach((q) => {
      const parentForm = map[q.template_id];
      if (parentForm && (!parentForm.current_version_id || q.template_version_id === parentForm.current_version_id)) {
        // Find the matching section, or fallback to the first section
        const section = parentForm.sections.find(sec => sec.section_id === q.section_id) || parentForm.sections[0];
        
        if (section) {
          let tags = [];
          try { tags = JSON.parse(q.tags_json || '[]'); } catch(e) {}

          let allowedEvidence = [];
          try { allowedEvidence = JSON.parse(q.allowed_evidence_json || '[]'); } catch(e) {}
          
          section.questions.push({
            question_id: q.question_id,
            question_text: q.question_text || q.help_text,
            response_type: q.response_type || 'YES_NO',
            evidence_policy: q.evidence_policy || 'OPTIONAL',
            allowed_evidence: allowedEvidence,
            scored: String(q.scored).toLowerCase() === 'true' || q.scored === true,
            max_score: Number(q.max_score || q.points) || 0,
            points: Number(q.max_score || q.points) || 0,
            failure_response: q.failure_response || 'NONE',
            critical_question: String(q.critical_question).toLowerCase() === 'true' || q.critical_question === true,
            na_allowed: String(q.na_allowed).toLowerCase() === 'true' || q.na_allowed === true,
            risk_category: q.risk_category || 'General',
            tags: tags,
            comment_required: q.comment_required || 'NEVER',
            question_order: Number(q.question_order) || section.questions.length + 1,
            is_required: q.required,
            instructions: q.instructions || q.template_instructions || ''
          });
        }
      }
    });

    // D. Sort sections and questions by their order
    Object.values(map).forEach(form => {
      form.sections.sort((a, b) => a.section_order - b.section_order);
      form.sections.forEach(sec => {
        sec.questions.sort((a, b) => a.question_order - b.question_order);
      });
    });

    return Object.values(map).reverse();
  }, [templates, sections, questions, data]);

  const filteredAndSortedForms = useMemo(() => {
    let result = [...groupedForms];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((form) =>
        (form.template_name || '').toLowerCase().includes(query) ||
        (form.template_description || '').toLowerCase().includes(query) ||
        (form.template_category || '').toLowerCase().includes(query) ||
        (form.audit_type || '').toLowerCase().includes(query) ||
        (form.owner || '').toLowerCase().includes(query)
      );
    }

    switch (sortBy) {
      case 'az':
        result.sort((a, b) => (a.template_name || '').localeCompare(b.template_name || ''));
        break;
      case 'za':
        result.sort((a, b) => (b.template_name || '').localeCompare(a.template_name || ''));
        break;
      case 'oldest':
        result.reverse();
        break;
      case 'latest':
      default:
        break;
    }

    return result;
  }, [groupedForms, searchQuery, sortBy]);

  const [formCardPage, setFormCardPage] = useState(1);
  const CARDS_PER_PAGE = 5;

  const totalCardPages = Math.ceil(filteredAndSortedForms.length / CARDS_PER_PAGE) || 1;
  const cardStartIndex = (formCardPage - 1) * CARDS_PER_PAGE;
  const paginatedForms = filteredAndSortedForms.slice(cardStartIndex, cardStartIndex + CARDS_PER_PAGE);

  useEffect(() => { setFormCardPage(1); }, [searchQuery, sortBy]);

  const [previewForm, setPreviewForm] = useState(null);

  useEffect(() => {
    setPreviewForm((current) => current
      ? groupedForms.find((form) => form.template_id === current.template_id) || null
      : null);
  }, [groupedForms]);

  const [activeMenuId, setActiveMenuId] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingForm, setEditingForm] = useState(null);
  const [deletingForm, setDeletingForm] = useState(null);
  const [assigningForm, setAssigningForm] = useState(null);
  const [visibilityForm, setVisibilityForm] = useState(null);

  const toggleMenu = (e, id) => { e.stopPropagation(); setActiveMenuId(activeMenuId === id ? null : id); };
  const handleEdit = (e, form) => { e.stopPropagation(); setActiveMenuId(null); setEditingForm(form); };
  const handleDelete = (e, form) => { e.stopPropagation(); setActiveMenuId(null); setDeletingForm(form); };
  const handleAssign = (e, form) => { e.stopPropagation(); setActiveMenuId(null); setAssigningForm(form); };
  const handleVisibility = (e, form) => { e.stopPropagation(); setActiveMenuId(null); setVisibilityForm(form); };

  const openPreview = (form) => { setPreviewForm(form); setActiveMenuId(null); };
  const closePreview = () => { setPreviewForm(null); };

  const previewQuestionCount = previewForm?.sections?.reduce((count, section) => count + (section.questions?.length || 0), 0) || 0;

  const currentSortLabel = SORT_OPTIONS.find((opt) => opt.value === sortBy)?.label || 'Latest First';

  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans text-slate-800" onClick={() => { setActiveMenuId(null); setIsSortMenuOpen(false); }}>

      {/* ── Header ── */}
      <div className="shrink-0 px-4 sm:px-6 lg:px-8 pt-6 pb-4">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">Forms</h1>
          </div>
          <button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm shadow-indigo-500/20 transition-all whitespace-nowrap shrink-0">
            <Plus className="w-4 h-4" /> Create Form
          </button>
        </div>

        {/* ── Search & Sort Bar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search forms by name, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setIsSortMenuOpen(!isSortMenuOpen); }}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <span className="text-slate-400 text-xs uppercase font-semibold tracking-wide">Sort:</span>
              <span>{currentSortLabel}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isSortMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {isSortMenuOpen && (
              <div className="absolute right-0 top-12 w-44 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-50" onClick={(e) => e.stopPropagation()}>
                {SORT_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = sortBy === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => { setSortBy(opt.value); setIsSortMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors ${isSelected ? 'text-indigo-600 bg-indigo-50' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`} />
                      <span>{opt.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 ml-auto text-indigo-500" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {searchQuery && (
          <p className="text-xs text-slate-400 mt-2.5">
            {filteredAndSortedForms.length === 0
              ? `No results for "${searchQuery}"`
              : `${filteredAndSortedForms.length} ${filteredAndSortedForms.length === 1 ? 'form' : 'forms'} found`}
          </p>
        )}
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex gap-5 px-4 sm:px-6 lg:px-8 pb-6 overflow-hidden">

        {groupedForms.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-3 max-w-sm w-full">
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto"><FileText className="w-6 h-6 text-slate-300" /></div>
              <div className="text-sm font-semibold text-slate-800">No Forms Found</div>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">There are no operational forms stored in your database yet.</p>
              <button onClick={() => setIsCreateOpen(true)} className="mt-1 bg-indigo-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors">+ Create First Form</button>
            </div>
          </div>
        ) : filteredAndSortedForms.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-3 max-w-sm w-full">
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto"><Search className="w-6 h-6 text-slate-300" /></div>
              <div className="text-sm font-semibold text-slate-800">No Results Found</div>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">No forms match your search. Try a different keyword or clear the search.</p>
              <button onClick={() => setSearchQuery('')} className="mt-1 bg-slate-100 text-slate-600 text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-200 transition-colors">Clear Search</button>
            </div>
          </div>
        ) : (
          <>
            {/* ═══ LEFT: Cards list ═══ */}
            <div
              className={`flex-col ${
                previewForm ? 'hidden lg:flex lg:w-[52%]' : 'flex w-full'
              } transition-all duration-300`}
            >
              <div className="flex items-center justify-between mb-3 shrink-0">
                <span className="text-sm font-semibold text-slate-700">
                  All Forms <span className="text-slate-400 font-normal">({filteredAndSortedForms.length})</span>
                </span>
                <span className="text-xs text-slate-400">Select a form to view its questions</span>
              </div>

              {/* Cards scroll area */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
                {paginatedForms.map((form) => {
                  const itemId = form.template_id || form.template_code;
                  const isActive = previewForm?.template_id === itemId || previewForm?.template_code === itemId;
                  const sectionsCount = form.sections?.length || 0;
                  const totalQuestions = form.sections?.reduce((a, s) => a + (s.questions?.length || 0), 0) || 0;
                  const isMenuOpen = activeMenuId === itemId;
                  const visibility = visibilityFor(formVisibility, itemId);

                  return (
                    <div
                      key={itemId}
                      onClick={() => openPreview(form)}
                      className={`group relative cursor-pointer p-4 rounded-xl border transition-all flex items-start gap-3 ${
                        isActive ? 'bg-white border-indigo-500 ring-1 ring-indigo-500/20 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                          <h3 className="font-semibold text-base text-slate-900 break-words">{form.template_name}</h3>
                          <span className="text-xs font-medium text-slate-400">{form.template_version || 'v1.0'}</span>
                        </div>
                        {form.template_description && <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">{form.template_description}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span>{sectionsCount} {sectionsCount === 1 ? 'section' : 'sections'}</span>
                          <span>{totalQuestions} {totalQuestions === 1 ? 'question' : 'questions'}</span>
                          <span className={visibility?.mode === 'HIDDEN_ALL' ? 'text-rose-600' : visibility?.mode === 'HIDDEN_SELECTED' ? 'text-amber-600' : 'text-emerald-700'}>{visibilityLabel(visibility)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(event) => handleVisibility(event, form)}
                          title={`Manage visibility for ${form.template_name}`}
                          aria-label={`Manage visibility for ${form.template_name}`}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Visibility
                        </button>
                        <div className="relative">
                          <button onClick={(e) => toggleMenu(e, itemId)} aria-label={`More actions for ${form.template_name}`} className="text-slate-500 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {isMenuOpen && (
                            <div className="absolute right-0 top-8 w-48 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-20" onClick={(e) => e.stopPropagation()}>
                              <button onClick={(e) => handleEdit(e, form)} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"><Pencil className="w-3.5 h-3.5 text-indigo-500" /> Edit</button>
                              <button onClick={(e) => handleAssign(e, form)} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"><User className="w-3.5 h-3.5" /> Assign auditors</button>
                              <button onClick={(e) => handleDelete(e, form)} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"><Trash2 className="w-3.5 h-3.5 text-rose-500" /> Delete current version</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ═══ Pagination ═══ */}
              <div className="shrink-0 flex items-center justify-between pt-3 mt-1 border-t border-slate-200 text-xs">
                <span className="text-slate-500 font-medium">
                  {filteredAndSortedForms.length === 0
                    ? 'No forms'
                    : `Showing ${cardStartIndex + 1}–${Math.min(cardStartIndex + CARDS_PER_PAGE, filteredAndSortedForms.length)} of ${filteredAndSortedForms.length}`
                  }
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={formCardPage === 1}
                    onClick={() => setFormCardPage((p) => Math.max(p - 1, 1))}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2.5 text-slate-700 font-semibold">
                    {formCardPage} / {totalCardPages}
                  </span>
                  <button
                    disabled={formCardPage === totalCardPages}
                    onClick={() => setFormCardPage((p) => Math.min(p + 1, totalCardPages))}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* ═══ RIGHT: Preview panel ═══ */}
            {previewForm && (
              <div className="w-full lg:w-[48%] lg:min-w-[380px] shrink-0 flex flex-col">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1 overflow-hidden">
                  <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100 shrink-0">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Form details</p>
                      <h2 className="mt-1 text-xl font-bold text-slate-900 break-words">{previewForm.template_name}</h2>
                      <p className="mt-1 text-sm text-slate-500">{previewForm.template_status} · {previewForm.audit_type || 'Internal Audit'} · {previewForm.template_version || 'v1.0'} · {previewForm.estimated_minutes || 15} min</p>
                    </div>
                    <button onClick={closePreview} aria-label="Close form details" className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {previewForm.template_description && <p className="text-sm leading-relaxed text-slate-600">{previewForm.template_description}</p>}

                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-slate-50 p-4 text-sm">
                      <div><span className="block text-xs text-slate-500">Created by</span><span className="font-medium text-slate-800 break-words">{userName(previewForm.created_by)}</span></div>
                      <div><span className="block text-xs text-slate-500">Last edited by</span><span className="font-medium text-slate-800 break-words">{userName(previewForm.last_edited_by)}</span></div>
                    </div>

                    <div>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="text-base font-semibold text-slate-900">Sections and questions</h3>
                        <span className="text-xs text-slate-500">{previewForm.sections?.length || 0} sections · {previewQuestionCount} questions</span>
                      </div>
                      {previewForm.sections?.length ? (
                        <div className="space-y-3">
                          {previewForm.sections.map((section, sectionIndex) => (
                            <details key={section.section_id || sectionIndex} open={sectionIndex === 0} className="group rounded-xl border border-slate-200 bg-white">
                              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
                                <div className="min-w-0">
                                  <h4 className="font-semibold text-slate-900 break-words">{sectionIndex + 1}. {section.section_name}</h4>
                                  <p className="mt-1 text-xs text-slate-500">{[section.section_category, section.section_weight != null ? `${section.section_weight}% weight` : null, `${section.questions?.length || 0} questions`].filter(Boolean).join(' · ')}</p>
                                </div>
                                <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
                              </summary>
                              <div className="border-t border-slate-100 px-4 pb-4">
                                {section.section_instructions && <p className="py-3 text-sm text-slate-500">{section.section_instructions}</p>}
                                {section.questions?.length ? section.questions.map((question, questionIndex) => (
                                  <div key={question.question_id || questionIndex} className="border-b border-slate-100 py-3 last:border-b-0 last:pb-0">
                                    <div className="flex items-start gap-3">
                                      <span className="shrink-0 text-xs font-semibold text-indigo-600">{sectionIndex + 1}.{questionIndex + 1}</span>
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium leading-relaxed text-slate-800 break-words">{question.question_text || 'Untitled question'}</p>
                                        <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
                                          <span>{(question.response_type || 'YES_NO').replaceAll('_', ' / ')}</span>
                                          {question.critical_question && <span className="inline-flex items-center gap-1 text-rose-600"><AlertTriangle className="h-3 w-3" />Critical</span>}
                                          {question.evidence_policy && question.evidence_policy !== 'NONE' && <span>Evidence: {question.evidence_policy.toLowerCase().replaceAll('_', ' ')}</span>}
                                        </div>
                                        {question.instructions && <p className="mt-2 text-xs leading-relaxed text-slate-500">{question.instructions}</p>}
                                      </div>
                                    </div>
                                  </div>
                                )) : <p className="py-4 text-sm text-slate-500">No questions in this section.</p>}
                              </div>
                            </details>
                          ))}
                        </div>
                      ) : <p className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">No sections in this form.</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {isCreateOpen && (
        <CreateFormModal existingForms={groupedForms} locations={locations} users={users} currentUser={currentUser} onClose={() => setIsCreateOpen(false)} onCreated={() => { setPreviewForm(null); setFormCardPage(1); if (onRefreshData) onRefreshData(); }} />
      )}
      {editingForm && (
        <UpdateFormModal form={editingForm} currentUser={currentUser} onClose={() => setEditingForm(null)} onUpdated={() => { if (onRefreshData) onRefreshData(); }} />
      )}
      {deletingForm && (
        <DeleteFormModal form={deletingForm} onClose={() => setDeletingForm(null)} onDeleted={() => { setPreviewForm(null); if (onRefreshData) onRefreshData(); }} />
      )}
      {assigningForm && (
        <AssignFormAuditorsModal form={assigningForm} users={users} locations={locations} onClose={() => setAssigningForm(null)} onAssigned={() => onRefreshData?.()} />
      )}
      {visibilityForm && (
        <FormVisibilityModal form={visibilityForm} locations={locations}
          visibility={visibilityFor(formVisibility, visibilityForm.template_id)}
          onClose={() => setVisibilityForm(null)} onSaved={() => onRefreshData?.()} />
      )}
    </div>
  );
}
