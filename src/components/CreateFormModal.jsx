import React, { useState, useMemo } from 'react';
import {
  Loader2, X, Plus, Trash2, HelpCircle, Camera,
  Layers, FileText, ChevronLeft, Check, ArrowRight,
  ShieldCheck, AlertTriangle
} from 'lucide-react';
import { supabase } from '../supabaseClient'; // 1. Import your Supabase client

const RESPONSE_TYPES = [
  { value: 'YES_NO', label: 'Yes / No' }, { value: 'PASS_FAIL', label: 'Pass / Fail' },
  { value: 'PHOTO', label: 'Photo Evidence' }, { value: 'RATING', label: 'Rating (1-5)' }
];
const EVIDENCE_POLICIES = [
  { value: 'NONE', label: 'Not Required' }, { value: 'OPTIONAL', label: 'Optional' },
  { value: 'MANDATORY', label: 'Always Required' }, { value: 'MANDATORY_ON_FAIL', label: 'Required on Failure' }
];

const EVIDENCE_TYPES = [
  { value: 'PHOTO', label: 'Photo', icon: Camera }
];

const AUDIT_TYPES = ['Internal Audit', 'External Audit', 'Safety & Compliance', 'Process / Operational', 'Spot Check'];

const FAILURE_RESPONSES = [
  { value: 'NONE', label: 'None — record only' },
  { value: 'FLAG', label: 'Flag as failure' },
  { value: 'MANDATORY_COMMENT', label: 'Require comment' },
  { value: 'MANDATORY_EVIDENCE', label: 'Require evidence' },
  { value: 'RAISE_NC', label: 'Raise Non-Conformance' },
  { value: 'BLOCK_SUBMIT', label: 'Block submission' }
];
const RISK_CATEGORIES = ['General', 'Food Safety', 'Fire Safety', 'Hygiene', 'Compliance', 'Operational', 'Cold Chain', 'Infrastructure', 'Workforce'];
const COMMENT_REQUIREMENTS = [
  { value: 'NEVER', label: 'Never' },
  { value: 'ALWAYS', label: 'Always' },
  { value: 'ON_FAIL', label: 'On failure' },
  { value: 'ON_CRITICAL', label: 'On critical failure' },
  { value: 'ON_NA', label: 'When N/A selected' }
];

const newQuestion = () => ({
  question_text: '', response_type: 'YES_NO', evidence_policy: 'OPTIONAL',
  allowed_evidence: ['PHOTO'],
  points: 1, is_required: true, instructions: '', showInstructions: false,
  scored: false, failure_response: 'NONE', critical_question: false,
  na_allowed: false, risk_category: 'General', tags: [], comment_required: 'NEVER'
});

export default function CreateFormModal({ existingForms = [], onClose, onCreated }) {
  const [step, setStep] = useState(0);

  const dynamicCategories = useMemo(() => {
    const defaultCats = ['Operations', 'Food Safety & Hygiene', 'Cold Chain Compliance', 'Safety & Maintenance'];
    const extracted = existingForms.map((t) => t.template_category).filter(Boolean);
    return Array.from(new Set([...defaultCats, ...extracted]));
  }, [existingForms]);

  const [categories, setCategories] = useState(dynamicCategories);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    template_name: '', template_category: categories[0] || 'Operations',
    template_description: '', template_instructions: '',
    audit_type: 'Internal Audit', template_owner_id: '',
    applicable_locations: 'All Locations',
    effective_date: new Date().toISOString().split('T')[0],
    template_status: 'Published', estimated_minutes: 15,
    sample_size: '',
    sections: [{ section_name: 'General Inspection', section_order: 1, section_instructions: '', questions: [newQuestion()] }]
  });

  const isStep1Valid = formData.template_name.trim().length > 0;
  const totalSections = formData.sections.length;
  const totalQuestions = formData.sections.reduce((a, s) => a + s.questions.length, 0);
  const onFormDetails = step === 0;
  const onSection = step >= 1;
  const currentSectionIdx = step - 1;
  const onFirstSection = step === 1;

  const currentSection = onSection ? formData.sections[currentSectionIdx] : null;
  const currentSectionHasQuestions = currentSection
    ? currentSection.questions.some((q) => q.question_text.trim() !== '')
    : false;

  const canAddSection = isStep1Valid && (onFormDetails || currentSectionHasQuestions);
  const hasAnyQuestions = formData.sections.some((s) => s.questions.some((q) => q.question_text.trim() !== ''));
  const canSaveForm = isStep1Valid && hasAnyQuestions;

  const handleAddCustomCategory = () => {
    if (!newCategoryInput.trim()) return;
    const addedCat = newCategoryInput.trim();
    if (!categories.includes(addedCat)) setCategories((prev) => [...prev, addedCat]);
    setFormData((prev) => ({ ...prev, template_category: addedCat }));
    setNewCategoryInput(''); setIsAddingCategory(false);
  };

  const handleChange = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

  const addSection = () => {
    const newSec = { section_name: `Section ${totalSections + 1}`, section_order: totalSections + 1, section_instructions: '', questions: [newQuestion()] };
    setFormData((prev) => ({ ...prev, sections: [...prev.sections, newSec] }));
    setStep(totalSections + 1);
  };

  const removeSection = (sIdx) => setFormData((prev) => {
    const newSections = prev.sections.filter((_, i) => i !== sIdx);
    if (step > newSections.length) setStep(newSections.length);
    return { ...prev, sections: newSections };
  });

  const updateSectionName = (sIdx, value) => setFormData((prev) => ({ ...prev, sections: prev.sections.map((sec, i) => (i === sIdx ? { ...sec, section_name: value } : sec)) }));
  const addQuestion = (sIdx) => setFormData((prev) => ({ ...prev, sections: prev.sections.map((sec, i) => (i === sIdx ? { ...sec, questions: [...sec.questions, newQuestion()] } : sec)) }));
  const updateQuestion = (sIdx, qIdx, field, value) => setFormData((prev) => ({ ...prev, sections: prev.sections.map((sec, i) => { if (i !== sIdx) return sec; return { ...sec, questions: sec.questions.map((q, j) => (j === qIdx ? { ...q, [field]: value } : q)) }; }) }));
  const toggleEvidenceType = (sIdx, qIdx, evidenceValue) => setFormData((prev) => ({ ...prev, sections: prev.sections.map((sec, i) => { if (i !== sIdx) return sec; return { ...sec, questions: sec.questions.map((q, j) => { if (j !== qIdx) return q; const currentList = q.allowed_evidence || []; const exists = currentList.includes(evidenceValue); return { ...q, allowed_evidence: exists ? currentList.filter((item) => item !== evidenceValue) : [...currentList, evidenceValue] }; }) }; }) }));
  const toggleInstructions = (sIdx, qIdx) => setFormData((prev) => ({ ...prev, sections: prev.sections.map((sec, i) => { if (i !== sIdx) return sec; return { ...sec, questions: sec.questions.map((q, j) => (j === qIdx ? { ...q, showInstructions: !q.showInstructions } : q)) }; }) }));
  const removeQuestion = (sIdx, qIdx) => setFormData((prev) => ({ ...prev, sections: prev.sections.map((sec, i) => { if (i !== sIdx) return sec; return { ...sec, questions: sec.questions.filter((_, j) => j !== qIdx) }; }) }));

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!isStep1Valid) { setStep(0); return; }
    if (!hasAnyQuestions) { setStep(1); return; }

    setError('');
    setSubmitting(true);
    const templateId = `TMP-${Date.now()}`;

    try {
      // 1. Insert into templates table
      const { error: templateError } = await supabase
        .from('templates')
        .insert([{
          template_id: templateId,
          template_name: formData.template_name,
          template_category: formData.template_category,
          template_description: formData.template_description,
          template_status: 'Published',
          template_version: 'v1.0',
          estimated_minutes: Number(formData.estimated_minutes) || 15,
          active: true
        }]);

      if (templateError) throw templateError;

      // 2. Prepare sections & questions for insertion
      for (let secIdx = 0; secIdx < formData.sections.length; secIdx++) {
        const sec = formData.sections[secIdx];
        const sectionId = `${templateId}-SEC-${secIdx + 1}`;
        
        // Insert section
        const { error: sectionError } = await supabase
          .from('sections')
          .insert([{
            section_id: sectionId,
            template_id: templateId,
            section_name: sec.section_name || `Section ${secIdx + 1}`,
            section_order: secIdx + 1,
            section_instructions: sec.section_instructions || ''
          }]);

        if (sectionError) throw sectionError;

        // Prepare questions for this section
        const validQuestions = sec.questions.filter(q => q.question_text.trim() !== '');
        if (validQuestions.length > 0) {
          const questionsToInsert = validQuestions.map((q, qIdx) => ({
            question_id: `${sectionId}-Q${qIdx + 1}`,
            template_id: templateId,
            section_id: sectionId,
            question_text: q.question_text,
            question_order: qIdx + 1,
            response_type: q.response_type,
            required: q.is_required,
            scored: q.scored,
            max_score: Number(q.points) || 0,
            failure_response: q.failure_response,
            critical_question: q.critical_question,
            na_allowed: q.na_allowed,
            risk_category: q.risk_category,
            comment_required: q.comment_required,
            evidence_policy: q.evidence_policy
          }));

          // Insert questions
          const { error: questionsError } = await supabase
            .from('question_bank')
            .insert(questionsToInsert);

          if (questionsError) throw questionsError;
        }
      }

      setSubmitting(false);
      if (onCreated) onCreated();
      onClose();

    } catch (err) {
      console.error('Error creating form:', err);
      setError(err.message || 'Failed to create form.');
      setSubmitting(false);
    }
  };

  const inputCls = "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all";
  const labelCls = "block text-xs font-semibold text-slate-500 mb-1.5";
  const sectionCls = "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all";

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl max-h-[92vh] flex flex-col">

        <div className="px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <FileText className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Create New Form</h2>
                <p className="text-xs text-slate-400">Build your checklist step by step</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mb-2 p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-[11px] font-semibold flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1">
            <div className="flex items-center gap-2 shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 ${step >= 0 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                {step > 0 ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <span className={`text-xs font-semibold whitespace-nowrap transition-colors ${step >= 0 ? 'text-slate-800' : 'text-slate-400'}`}>Details</span>
            </div>
            {formData.sections.map((sec, i) => (
              <React.Fragment key={i}>
                <div className={`w-6 h-0.5 rounded-full shrink-0 transition-colors ${step > i ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                <div className="flex items-center gap-2 shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 ${step > i + 1 ? 'bg-indigo-600 text-white' : step === i + 1 ? 'bg-indigo-600 text-white ring-2 ring-indigo-200' : 'bg-slate-100 text-slate-400'}`}>
                    {step > i + 1 ? <Check className="w-4 h-4" /> : i + 2}
                  </div>
                  <span className={`text-xs font-semibold whitespace-nowrap transition-colors ${step >= i + 1 ? 'text-slate-800' : 'text-slate-400'}`}>
                    {sec.section_name?.length > 14 ? sec.section_name.slice(0, 14) + '…' : (sec.section_name || `Section ${i + 1}`)}
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 flex-1">
          {onFormDetails && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-indigo-600">1</span>
                </div>
                <h3 className="text-sm font-bold text-slate-700">Form Details</h3>
                <span className="text-xs text-slate-400 ml-1">— Basic information about this form</span>
              </div>

              <div className="bg-slate-50/60 rounded-2xl border border-slate-100 p-4 space-y-4">
                <div>
                  <label className={labelCls}>Form Name <span className="text-rose-400">*</span></label>
                  <input required type="text" placeholder="e.g. Daily Store Readiness Checklist" className={inputCls} value={formData.template_name} onChange={(e) => handleChange('template_name', e.target.value)} />
                  {!isStep1Valid && (
                    <p className="text-[11px] text-rose-400 mt-1 font-medium">Form name is required to continue</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Category</label>
                    {isAddingCategory ? (
                      <div className="flex gap-2">
                        <input type="text" placeholder="Enter category name" className={sectionCls} value={newCategoryInput} onChange={(e) => setNewCategoryInput(e.target.value)} />
                        <button type="button" onClick={handleAddCustomCategory} className="bg-indigo-600 text-white text-xs font-semibold px-3 rounded-xl hover:bg-indigo-700 shrink-0">Add</button>
                        <button type="button" onClick={() => setIsAddingCategory(false)} className="text-xs font-semibold text-slate-400 hover:text-slate-600 px-2 shrink-0">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <select className={sectionCls} value={formData.template_category} onChange={(e) => handleChange('template_category', e.target.value)}>
                          {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <button type="button" onClick={() => setIsAddingCategory(true)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 shrink-0 px-2 whitespace-nowrap">+ New</button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Audit Type</label>
                    <select className={sectionCls} value={formData.audit_type} onChange={(e) => handleChange('audit_type', e.target.value)}>
                      {AUDIT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Estimated Minutes</label>
                    <input type="number" min="1" className={sectionCls} value={formData.estimated_minutes} onChange={(e) => handleChange('estimated_minutes', e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Sample Size (SKU Count) <span className="text-slate-400 font-normal normal-case text-[10px]">(optional)</span></label>
                    <input type="number" min="0" placeholder="e.g. 50" className={sectionCls} value={formData.sample_size} onChange={(e) => handleChange('sample_size', e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Description</label>
                  <textarea rows="2" placeholder="Brief description of what this form is for..." className={inputCls} value={formData.template_description} onChange={(e) => handleChange('template_description', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {onSection && formData.sections[currentSectionIdx] && (
            <div className="space-y-5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <Layers className="w-4 h-4 text-indigo-600" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700">Section {currentSectionIdx + 1} of {totalSections}</h3>
                  <span className="text-xs text-slate-400 ml-1">— Add questions for this section</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4 text-slate-400" />
                  </div>
                  <input type="text" required placeholder="Section name..." className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" value={formData.sections[currentSectionIdx].section_name} onChange={(e) => updateSectionName(currentSectionIdx, e.target.value)} />
                  {totalSections > 1 && (
                    <button type="button" onClick={() => removeSection(currentSectionIdx)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="p-4 space-y-3">
                  {formData.sections[currentSectionIdx].questions.map((q, qIdx) => (
                    <div key={qIdx} className="bg-slate-50/50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[11px] font-bold">{qIdx + 1}</span>
                          <span className="text-sm font-semibold text-slate-700">Question {qIdx + 1}</span>
                          {q.critical_question && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded uppercase flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" /> Critical
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={q.is_required ?? true} onChange={(e) => updateQuestion(currentSectionIdx, qIdx, 'is_required', e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                            <span className="text-[11px] font-semibold text-slate-500">Required</span>
                          </label>
                          <button type="button" onClick={() => toggleInstructions(currentSectionIdx, qIdx)} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors">
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>{q.showInstructions || q.instructions ? 'Edit' : '+ Instructions'}</span>
                          </button>
                          {formData.sections[currentSectionIdx].questions.length > 1 && (
                            <button type="button" onClick={() => removeQuestion(currentSectionIdx, qIdx)} className="p-1 text-slate-400 hover:text-rose-500 rounded-md hover:bg-rose-50 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <input required type="text" placeholder="Type your question here..." className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" value={q.question_text} onChange={(e) => updateQuestion(currentSectionIdx, qIdx, 'question_text', e.target.value)} />

                      {(q.showInstructions || q.instructions) && (
                        <input type="text" placeholder="Add helpful instructions for this question..." className="w-full bg-amber-50/50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-slate-600 placeholder:text-amber-400/70 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" value={q.instructions || ''} onChange={(e) => updateQuestion(currentSectionIdx, qIdx, 'instructions', e.target.value)} />
                      )}

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Answer Type</label>
                          <select className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" value={q.response_type} onChange={(e) => updateQuestion(currentSectionIdx, qIdx, 'response_type', e.target.value)}>
                            {RESPONSE_TYPES.map((rt) => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Evidence</label>
                          <select className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" value={q.evidence_policy || 'OPTIONAL'} onChange={(e) => updateQuestion(currentSectionIdx, qIdx, 'evidence_policy', e.target.value)}>
                            {EVIDENCE_POLICIES.map((ep) => <option key={ep.value} value={ep.value}>{ep.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Max Score</label>
                          <input type="number" min="0" step="0.5" className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" value={q.points} onChange={(e) => updateQuestion(currentSectionIdx, qIdx, 'points', e.target.value)} />
                        </div>
                      </div>

                      {/* ── Scoring & Validation ── */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                          <ShieldCheck className="w-3.5 h-3.5" /> Scoring & Validation
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={q.scored ?? false} onChange={(e) => updateQuestion(currentSectionIdx, qIdx, 'scored', e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                            <span className="text-[11px] font-semibold text-slate-600">Scored</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={q.critical_question ?? false} onChange={(e) => updateQuestion(currentSectionIdx, qIdx, 'critical_question', e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer" />
                            <span className="text-[11px] font-semibold text-rose-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Critical</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={q.na_allowed ?? false} onChange={(e) => updateQuestion(currentSectionIdx, qIdx, 'na_allowed', e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-slate-600 focus:ring-slate-500 cursor-pointer" />
                            <span className="text-[11px] font-semibold text-slate-600">N/A allowed</span>
                          </label>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Failure Response</label>
                            <select className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" value={q.failure_response || 'NONE'} onChange={(e) => updateQuestion(currentSectionIdx, qIdx, 'failure_response', e.target.value)}>
                              {FAILURE_RESPONSES.map((fr) => <option key={fr.value} value={fr.value}>{fr.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Risk Category</label>
                            <select className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" value={q.risk_category || 'General'} onChange={(e) => updateQuestion(currentSectionIdx, qIdx, 'risk_category', e.target.value)}>
                              {RISK_CATEGORIES.map((rc) => <option key={rc} value={rc}>{rc}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Comment Required</label>
                            <select className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" value={q.comment_required || 'NEVER'} onChange={(e) => updateQuestion(currentSectionIdx, qIdx, 'comment_required', e.target.value)}>
                              {COMMENT_REQUIREMENTS.map((cr) => <option key={cr.value} value={cr.value}>{cr.label}</option>)}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Tags <span className="font-normal text-slate-300 normal-case">(comma separated)</span></label>
                          <input type="text" placeholder="e.g. fire, extinguisher, emergency" className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" value={(q.tags || []).join(', ')} onChange={(e) => updateQuestion(currentSectionIdx, qIdx, 'tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-2">Allowed Evidence Types</label>
                        <div className="flex flex-wrap gap-2">
                          {EVIDENCE_TYPES.map((type) => {
                            const Icon = type.icon;
                            const isSelected = (q.allowed_evidence || []).includes(type.value);
                            return (
                              <button key={type.value} type="button" onClick={() => toggleEvidenceType(currentSectionIdx, qIdx, type.value)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${isSelected ? 'bg-indigo-50 text-indigo-700 border border-indigo-300' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'}`}>
                                <Icon className="w-3.5 h-3.5" />
                                <span>{type.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}

                  <button type="button" onClick={() => addQuestion(currentSectionIdx)} className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-indigo-600 py-2 border-2 border-dashed border-slate-200 hover:border-indigo-300 rounded-xl transition-all">
                    <Plus className="w-3.5 h-3.5" /> Add Question
                  </button>
                </div>
              </div>

              {!currentSectionHasQuestions && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                  <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700 font-medium">Add at least one question to this section before adding a new section or saving.</p>
                </div>
              )}
            </div>
          )}

        </form>

        <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 shrink-0 bg-white">
          <div>
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
                <ChevronLeft className="w-4 h-4" />
                {onFirstSection ? 'Back to Details' : 'Previous Section'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onFormDetails && (
              <button type="button" disabled={!isStep1Valid} onClick={() => setStep(1)} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${isStep1Valid ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                Next <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {onSection && (
              <>
                <button type="button" disabled={!canAddSection} onClick={addSection} title={!canAddSection ? (!isStep1Valid ? 'Fill form details first' : !currentSectionHasQuestions ? 'Add at least one question first' : '') : 'Add a new section'} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${canAddSection ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-slate-300 bg-slate-50 cursor-not-allowed'}`}>
                  <Plus className="w-4 h-4" /> Add Section
                </button>
                <button type="button" onClick={handleSubmit} disabled={submitting || !canSaveForm} title={!canSaveForm ? (!isStep1Valid ? 'Fill form details first' : 'Add at least one question first') : 'Save the form'} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Saving...' : 'Save Form'}
                </button>
              </>
            )}
          </div>
        </div>

        {onSection && (
          <div className="px-6 py-2 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">{totalQuestions} question(s) across {totalSections} section(s)</p>
          </div>
        )}

      </div>
    </div>
  );
}