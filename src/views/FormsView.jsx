import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, MoreHorizontal, FileText, Pencil, Trash2, ChevronLeft, ChevronRight, 
  Info, MapPin, User, Calendar, ShieldCheck, Camera, FileSignature, QrCode, 
  LayoutGrid, Clock, Layers, ListChecks, X, ChevronRight as ChevronRightIcon,
  Search, ChevronDown, ArrowDownAZ, ArrowUpAZ, Clock as ClockIcon, Check, AlertTriangle 
} from 'lucide-react';
import CreateFormModal from '../components/CreateFormModal';
import UpdateFormModal from '../components/UpdateFormModal';
import DeleteFormModal from '../components/DeleteFormModal';

// UPDATED: Now accepts templates, sections, and questions as separate arrays
export default function FormsView({ templates = [], sections = [], questions = [], data = [], onRefreshData }) {

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  const SORT_OPTIONS = [
    { value: 'latest', label: 'Latest First', icon: ClockIcon },
    { value: 'oldest', label: 'Oldest First', icon: ClockIcon },
    { value: 'az', label: 'A → Z', icon: ArrowDownAZ },
    { value: 'za', label: 'Z → A', icon: ArrowUpAZ },
  ];

  // 1. RELATIONAL DATA MAPPING (Stitching Supabase tables together)
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
        estimated_minutes: Number(t.estimated_minutes) || 15,
        sections: []
      };
    });

    // B. Attach Sections to Templates
    sList.forEach((s) => {
      const parentForm = map[s.template_id];
      if (parentForm) {
        parentForm.sections.push({
          section_id: s.section_id,
          section_name: s.section_name || 'General Inspection',
          section_order: Number(s.section_order) || parentForm.sections.length + 1,
          section_instructions: s.section_instructions || '',
          questions: []
        });
      }
    });

    // C. Attach Questions to Sections
    qList.forEach((q) => {
      const parentForm = map[q.template_id];
      if (parentForm) {
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
  const [currentQuestionPage, setCurrentQuestionPage] = useState(1);
  const QUESTIONS_PER_PAGE = 1;

  const [activeMenuId, setActiveMenuId] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingForm, setEditingForm] = useState(null);
  const [deletingForm, setDeletingForm] = useState(null);

  useEffect(() => { setCurrentQuestionPage(1); }, [previewForm]);

  const toggleMenu = (e, id) => { e.stopPropagation(); setActiveMenuId(activeMenuId === id ? null : id); };
  const handleEdit = (e, form) => { e.stopPropagation(); setActiveMenuId(null); setEditingForm(form); };
  const handleDelete = (e, form) => { e.stopPropagation(); setActiveMenuId(null); setDeletingForm(form); };

  const openPreview = (form) => { setPreviewForm(form); setActiveMenuId(null); };
  const closePreview = () => { setPreviewForm(null); };

  const allFormQuestions = useMemo(() => {
    if (!previewForm?.sections) return [];
    const list = [];
    previewForm.sections.forEach((sec, sIdx) => {
      (sec.questions || []).forEach((q) => {
        list.push({ ...q, section_name: sec.section_name, section_instructions: sec.section_instructions, section_order: sec.section_order || sIdx + 1, display_order: list.length + 1 });
      });
    });
    return list;
  }, [previewForm]);

  const totalQuestionPages = Math.ceil(allFormQuestions.length / QUESTIONS_PER_PAGE) || 1;
  const qStartIndex = (currentQuestionPage - 1) * QUESTIONS_PER_PAGE;
  const paginatedQuestions = allFormQuestions.slice(qStartIndex, qStartIndex + QUESTIONS_PER_PAGE);

  const currentSortLabel = SORT_OPTIONS.find((opt) => opt.value === sortBy)?.label || 'Latest First';

  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans text-slate-800" onClick={() => { setActiveMenuId(null); setIsSortMenuOpen(false); }}>

      {/* ── Header ── */}
      <div className="shrink-0 px-4 sm:px-6 lg:px-8 pt-6 pb-4">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                <LayoutGrid className="w-4 h-4 text-indigo-600" />
              </div>
              <span className="text-xs font-semibold text-indigo-600 tracking-wider uppercase">Form Builder</span>
            </div>
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
                previewForm ? 'hidden lg:flex lg:w-[60%]' : 'flex w-full'
              } transition-all duration-300`}
            >
              <div className="flex items-center justify-between mb-3 shrink-0">
                <span className="text-sm font-semibold text-slate-700">
                  All Forms <span className="text-slate-400 font-normal">({filteredAndSortedForms.length})</span>
                </span>
                <span className="text-xs text-slate-400">{currentSortLabel}</span>
              </div>

              {/* Cards scroll area */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
                {paginatedForms.map((form) => {
                  const itemId = form.template_id || form.template_code;
                  const isActive = previewForm?.template_id === itemId || previewForm?.template_code === itemId;
                  const sectionsCount = form.sections?.length || 0;
                  const totalQuestions = form.sections?.reduce((a, s) => a + (s.questions?.length || 0), 0) || 0;
                  const isMenuOpen = activeMenuId === itemId;
                  const isPublished = form.template_status === 'Published';

                  return (
                    <div
                      key={itemId}
                      onClick={() => openPreview(form)}
                      className={`group relative cursor-pointer p-3.5 rounded-xl border transition-all flex items-center gap-3 ${
                        isActive ? 'bg-white border-indigo-500 ring-1 ring-indigo-500/20 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isActive ? 'bg-indigo-50' : 'bg-slate-50 group-hover:bg-indigo-50'}`}>
                        <FileText className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-semibold text-sm text-slate-900 truncate">{form.template_name}</h3>
                          <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase ${isPublished ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isPublished ? 'bg-emerald-500' : 'bg-amber-500'}`} />{isPublished ? 'Published' : 'Draft'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-1 leading-relaxed">{form.template_description || 'Standard operational procedure checklist.'}</p>
                      </div>

                      <div className="hidden lg:flex items-center gap-3 text-[11px] text-slate-400 shrink-0">
                        <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5" />{sectionsCount}</span>
                        <span className="flex items-center gap-1"><ListChecks className="w-3.5 h-3.5" />{totalQuestions}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{form.template_version || 'v1.0'}</span>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <div className="relative">
                          <button onClick={(e) => toggleMenu(e, itemId)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {isMenuOpen && (
                            <div className="absolute right-0 top-8 w-32 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-20" onClick={(e) => e.stopPropagation()}>
                              <button onClick={(e) => handleEdit(e, form)} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"><Pencil className="w-3.5 h-3.5 text-indigo-500" /> Edit</button>
                              <button onClick={(e) => handleDelete(e, form)} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"><Trash2 className="w-3.5 h-3.5 text-rose-500" /> Delete</button>
                            </div>
                          )}
                        </div>
                        <ChevronRightIcon className={`w-4 h-4 transition-colors ${isActive ? 'text-indigo-500' : 'text-slate-300'}`} />
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
              <div className="w-full lg:w-[40%] lg:min-w-[340px] shrink-0 flex flex-col">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1 overflow-hidden">
                  <div className="flex items-start justify-between p-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-indigo-600" /></div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-semibold text-indigo-600 tracking-wider uppercase block">Form Preview</span>
                        <h2 className="text-sm font-bold text-slate-900 truncate">{previewForm.template_name}</h2>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold uppercase ${previewForm.template_status === 'Published' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${previewForm.template_status === 'Published' ? 'bg-emerald-500' : 'bg-amber-500'}`} />{previewForm.template_status === 'Published' ? 'Published' : 'Draft'}
                      </span>
                      <button onClick={closePreview} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold mb-2.5 tracking-wide">Details</div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-2">
                          <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[9px] text-slate-400 uppercase font-semibold">Audit Type</div>
                            <div className="text-xs font-semibold text-slate-700 truncate">{previewForm.audit_type || 'Internal Audit'}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-2">
                          <User className="w-4 h-4 text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[9px] text-slate-400 uppercase font-semibold">Created By</div>
                            <div className="text-xs font-semibold text-slate-700 truncate">{previewForm.created_by}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-2">
                          <FileSignature className="w-4 h-4 text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[9px] text-slate-400 uppercase font-semibold">Last Edited By</div>
                            <div className="text-xs font-semibold text-slate-700 truncate">{previewForm.last_edited_by}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-2">
                          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[9px] text-slate-400 uppercase font-semibold">Estimated Duration</div>
                            <div className="text-xs font-semibold text-slate-700">{previewForm.estimated_minutes ? `${previewForm.estimated_minutes} min` : 'Unspecified'}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {previewForm.template_description && (
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1.5 tracking-wide">Description</div>
                        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-lg px-3 py-2.5">{previewForm.template_description}</p>
                      </div>
                    )}

                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold mb-2.5 tracking-wide">Questions ({allFormQuestions.length})</div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-3">
                        <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200/60">
                          <span className="font-semibold text-slate-700 truncate pr-2">{paginatedQuestions[0]?.section_name || previewForm.sections?.[0]?.section_name || 'General Inspection'}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">{allFormQuestions.length} {allFormQuestions.length === 1 ? 'question' : 'questions'}</span>
                        </div>
                        <div className="space-y-2.5">
                          {paginatedQuestions.length > 0 ? (
                            paginatedQuestions.map((q) => {
                              const instructions = q.section_instructions || previewForm.template_instructions;
                              return (
                                <div key={q.question_id || q.display_order} className="bg-white p-3 rounded-lg border border-slate-200/60 text-xs space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-slate-700 font-semibold flex items-center gap-2 min-w-0">
                                      <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-bold shrink-0">{q.display_order}</span>
                                      <span className="truncate" title={q.question_text}>{q.question_text}</span>
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0 ml-1">
                                      {q.critical_question && (
                                        <span className="text-[9px] font-semibold px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded uppercase flex items-center gap-0.5">
                                          <AlertTriangle className="w-3 h-3" /> Critical
                                        </span>
                                      )}
                                      
                                      {q.evidence_policy && q.evidence_policy !== 'NONE' && (
                                        <span className="text-[9px] font-semibold px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded uppercase flex items-center gap-0.5">
                                          {q.evidence_policy === 'PHOTO' && <Camera className="w-3 h-3" />}
                                          {q.evidence_policy === 'SIGNATURE' && <FileSignature className="w-3 h-3" />}
                                          {(q.evidence_policy === 'BARCODE' || q.evidence_policy === 'QR_CODE') && <QrCode className="w-3 h-3" />}
                                          {q.evidence_policy}
                                        </span>
                                      )}
                                      <span className="text-[9px] font-semibold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase">{q.response_type || 'YES_NO'}</span>
                                    </div>
                                  </div>
                                  {instructions && (
                                    <div className="ml-7 p-2 bg-slate-50 border border-slate-100 rounded-md flex items-start gap-1.5">
                                      <Info className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5" />
                                      <p className="text-[11px] text-slate-500 leading-snug font-medium">Instructions: {instructions}</p>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-slate-400 text-[11px] italic py-4 text-center">No questions available in this form.</div>
                          )}
                        </div>

                        {totalQuestionPages > 1 && (
                          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                            <span className="text-[11px] font-medium text-slate-400">Question {qStartIndex + 1} of {allFormQuestions.length}</span>
                            <div className="flex items-center gap-1">
                              <button disabled={currentQuestionPage === 1} onClick={() => setCurrentQuestionPage((p) => Math.max(p - 1, 1))} className="p-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"><ChevronLeft className="w-3.5 h-3.5" /></button>
                              <span className="px-1.5 text-slate-600 font-semibold text-[11px]">{currentQuestionPage} / {totalQuestionPages}</span>
                              <button disabled={currentQuestionPage === totalQuestionPages} onClick={() => setCurrentQuestionPage((p) => Math.min(p + 1, totalQuestionPages))} className="p-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"><ChevronRight className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        )}
                      </div>
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
        <CreateFormModal existingForms={groupedForms} onClose={() => setIsCreateOpen(false)} onCreated={() => { setPreviewForm(null); setFormCardPage(1); if (onRefreshData) onRefreshData(); }} />
      )}
      {editingForm && (
        <UpdateFormModal form={editingForm} onClose={() => setEditingForm(null)} onUpdated={() => { if (onRefreshData) onRefreshData(); }} />
      )}
      {deletingForm && (
        <DeleteFormModal form={deletingForm} onClose={() => setDeletingForm(null)} onDeleted={() => { setPreviewForm(null); if (onRefreshData) onRefreshData(); }} />
      )}
    </div>
  );
}