import React, { useState, useMemo } from 'react';
import {
  Loader2, X, Plus, Trash2, HelpCircle, Camera, Layers, FileText,
  ChevronLeft, Check, ArrowRight, Pencil,
  ShieldCheck, AlertTriangle
} from 'lucide-react';
import { supabase } from '../../../shared/lib/supabaseClient'; // 1. Import your local data store client

const RESPONSE_TYPES = [
  { value: 'YES_NO', label: 'Yes / No' }, 
  { value: 'PASS_FAIL', label: 'Pass / Fail' },
  { value: 'PHOTO', label: 'Photo Evidence' },
  { value: 'COMPLETE_NOT_COMPLETE', label: 'Complete / Not Complete' },
  { value: 'RATING', label: 'Rating (1-5)' }
];

const getResponseScores = (responseType) => {
  const score = 1;

  const responseLabels = {
    YES_NO: ['Yes', 'No'],
    PASS_FAIL: ['Pass', 'Fail'],
    COMPLETE_NOT_COMPLETE: ['Complete', 'Not Complete']
  }[responseType];

  if (!responseLabels) return [];

  return [
    { label: responseLabels[0], score },
    { label: responseLabels[1], score: 0 },
    { label: 'N/A', score: 'Excluded' }
  ];
};

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
  { value: 'NEVER', label: 'Never' }, { value: 'ALWAYS', label: 'Always' },
  { value: 'ON_FAIL', label: 'On failure' }, { value: 'ON_CRITICAL', label: 'On critical failure' },
  { value: 'ON_NA', label: 'When N/A selected' }
];

const parseBool = (v) => String(v).toLowerCase() === 'true';
const parseTags = (v) => { try { return JSON.parse(v || '[]'); } catch { return Array.isArray(v) ? v : []; } };
const normalizeResponseType = (responseType) =>
  RESPONSE_TYPES.some((type) => type.value === responseType)
    ? responseType
    : 'YES_NO';

const blankQ = () => ({
  question_text: '', response_type: 'YES_NO', evidence_policy: 'OPTIONAL',
  allowed_evidence: [],
  points: 1, is_required: true, instructions: '', showInstructions: false,
  scored: true,
  na_allowed: false, risk_category: 'General', tags: [], comment_required: 'NEVER'
});

const hydrateQ = (q) => ({
  question_text: q.question_text || '',
  response_type: normalizeResponseType(q.response_type),
  evidence_policy: q.evidence_policy || 'OPTIONAL',
  allowed_evidence: q.allowed_evidence || [],
  points: 1,
  is_required: q.is_required ?? q.required ?? true,
  instructions: q.instructions || q.help_text || '',
  showInstructions: !!(q.instructions || q.help_text),
  scored: q.scored !== undefined ? parseBool(q.scored) : true,
  failure_response: q.failure_response || 'NONE',
  critical_question: q.critical_question !== undefined ? parseBool(q.critical_question) : false,
  na_allowed: q.na_allowed !== undefined ? parseBool(q.na_allowed) : false,
  risk_category: q.risk_category || 'General',
  tags: parseTags(q.tags_json || q.tags),
  comment_required: q.comment_required || 'NEVER'
});

export default function UpdateFormModal({ form, currentUser, onClose, onUpdated }) {
  const [step, setStep] = useState(0);

  const dynamicCategories = useMemo(() => {
    const defaultCats = ['Operations', 'Food Safety & Hygiene', 'Cold Chain Compliance', 'Safety & Maintenance'];
    const sectionCategories = (form?.sections || []).map((section) => section.section_category);
    return Array.from(new Set([...defaultCats, ...sectionCategories].filter(Boolean)));
  }, [form]);

  const categories = dynamicCategories;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState(() => ({
    template_id: form?.template_id || '',
    template_name: form?.template_name || '',
    template_category: form?.template_category || 'Operations',
    template_description: form?.template_description || '',
    template_instructions: form?.template_instructions || '',
    audit_type: form?.audit_type || 'Internal Audit',
    template_owner_id: form?.template_owner_id || form?.owner || '',
    applicable_locations: form?.applicable_locations || 'All Locations',
    effective_date: form?.effective_date || new Date().toISOString().split('T')[0],
    // Draft option removed — forms are always saved as Published
    template_status: 'Published',
    template_version: form?.template_version || 'v1.0',
    estimated_minutes: form?.estimated_minutes || 15,
    sample_size: form?.sample_size || '',
    sections: (form?.sections || []).length > 0
      ? form.sections.map((sec) => ({
          section_name: sec.section_name || 'General Inspection',
          section_category: sec.section_category || form?.template_category || 'Operations',
          section_weight: sec.section_weight ?? ((form?.sections || []).length === 1 ? 100 : ''),
          section_order: sec.section_order || 1,
          section_instructions: sec.section_instructions || '',
          questions: (sec.questions || []).length > 0 ? sec.questions.map(hydrateQ) : [blankQ()]
        }))
      : [{ section_name: 'General Inspection', section_category: form?.template_category || 'Operations', section_weight: 100, section_order: 1, section_instructions: '', questions: [blankQ()] }]
  }));

  const isStep1Valid = formData.template_name.trim().length > 0;
  const totalSections = formData.sections.length;
  const totalWeight = formData.sections.reduce((total, section) => total + (Number(section.section_weight) || 0), 0);
  const sectionDetailsValid = formData.sections.every((section) =>
    section.section_name.trim() && section.section_category.trim() &&
    section.section_weight !== '' && Number(section.section_weight) > 0 && Number(section.section_weight) <= 100
  ) && Math.abs(totalWeight - 100) < 0.01;
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
  const canSaveForm = isStep1Valid && hasAnyQuestions && sectionDetailsValid;

  const handleChange = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

  const addSection = () => {
    const newSec = { section_name: `Section ${totalSections + 1}`, section_category: formData.sections[formData.sections.length - 1]?.section_category || categories[0], section_weight: 0, section_order: totalSections + 1, section_instructions: '', questions: [blankQ()] };
    setFormData((prev) => ({ ...prev, sections: [...prev.sections, newSec] }));
    setStep(totalSections + 1);
  };

  const removeSection = (sIdx) => setFormData((prev) => {
    const newSections = prev.sections.filter((_, i) => i !== sIdx);
    if (step > newSections.length) setStep(newSections.length);
    return { ...prev, sections: newSections };
  });

  const updateSectionField = (sIdx, field, value) => setFormData((prev) => ({ ...prev, sections: prev.sections.map((sec, i) => (i === sIdx ? { ...sec, [field]: value } : sec)) }));
  const addQuestion = (sIdx) => setFormData((prev) => ({ ...prev, sections: prev.sections.map((sec, i) => (i === sIdx ? { ...sec, questions: [...sec.questions, blankQ()] } : sec)) }));

  const updateQuestion = (sIdx, qIdx, field, value) =>
  setFormData((prev) => ({
    ...prev,
    sections: prev.sections.map((sec, i) => {
      if (i !== sIdx) return sec;

      return {
        ...sec,
        questions: sec.questions.map((q, j) => {
          if (j !== qIdx) return q;

          const updated = { ...q, [field]: value };
          if (field === 'response_type' && value !== 'PHOTO') {
            updated.allowed_evidence = [];
          }
          return updated;
        })
      };
    })
  }));

  const toggleEvidenceType = (sIdx, qIdx, evidenceValue) => setFormData((prev) => ({ ...prev, sections: prev.sections.map((sec, i) => { if (i !== sIdx) return sec; return { ...sec, questions: sec.questions.map((q, j) => { if (j !== qIdx) return q; const currentList = q.allowed_evidence || []; const exists = currentList.includes(evidenceValue); return { ...q, allowed_evidence: exists ? currentList.filter((item) => item !== evidenceValue) : [...currentList, evidenceValue] }; }) }; }) }));
  const toggleInstructions = (sIdx, qIdx) => setFormData((prev) => ({ ...prev, sections: prev.sections.map((sec, i) => { if (i !== sIdx) return sec; return { ...sec, questions: sec.questions.map((q, j) => (j === qIdx ? { ...q, showInstructions: !q.showInstructions } : q)) }; }) }));
  const removeQuestion = (sIdx, qIdx) => setFormData((prev) => ({ ...prev, sections: prev.sections.map((sec, i) => { if (i !== sIdx) return sec; return { ...sec, questions: sec.questions.filter((_, j) => j !== qIdx) }; }) }));

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!isStep1Valid) { setStep(0); return; }
    if (!hasAnyQuestions) { setStep(1); return; }
    if (!sectionDetailsValid) { setError('Enter section details and make weights total 100%.'); setStep(1); return; }

    setError('');
    setSubmitting(true);
    const templateId = formData.template_id;

    try {
      const { data: publishedVersion, error: publishError } =
      await supabase.rpc('publish_template_version', {
        p_template_id: templateId,
        p_template: {
          template_name: formData.template_name,
          template_category: formData.template_category,
          template_description: formData.template_description,
          estimated_minutes: Number(formData.estimated_minutes) || 15
        },
        p_sections: formData.sections,
        p_actor: currentUser?.user_id || currentUser?.name || 'System Admin',
        p_change_summary: 'Published from form editor'
      });

      if (publishError) throw publishError;
      console.info('Published template version:', publishedVersion?.template_version);

      setSubmitting(false);
      if (onUpdated) onUpdated();
      onClose();

    } catch (err) {
      console.error('Error updating form:', err);
      setError(err.message || 'Failed to update form.');
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
                <Pencil className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Edit Form</h2>
                <p className="text-xs text-slate-400">Update your checklist step by step</p>
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
                <span className="text-xs text-slate-400 ml-1">— Update basic information</span>
              </div>

              <div className="bg-slate-50/60 rounded-2xl border border-slate-100 p-4 space-y-4">
                <div>
                  <label className={labelCls}>Form Name <span className="text-rose-400">*</span></label>
                  <input required type="text" placeholder="e.g. Daily Store Readiness Checklist" className={inputCls} value={formData.template_name} onChange={(e) => handleChange('template_name', e.target.value)} />
                  {!isStep1Valid && (
                    <p className="text-[11px] text-rose-400 mt-1 font-medium">Form name is required to continue</p>
                  )}
                </div>

                <div>
                    <label className={labelCls}>Audit Type</label>
                    <select className={sectionCls} value={formData.audit_type} onChange={(e) => handleChange('audit_type', e.target.value)}>
                      {AUDIT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Estimated Minutes</label>
                    <input type="number" min="1" className={sectionCls} value={formData.estimated_minutes} onChange={(e) => handleChange('estimated_minutes', e.target.value)} />
                  </div>
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
                  <h3 className="text-sm font-bold text-slate-700">
                    {formData.sections[currentSectionIdx].section_name || 'Untitled Section'}
                  </h3>
                  <span className="text-xs text-slate-400">
                    Section {currentSectionIdx + 1} of {totalSections}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
                <h4 className="mb-3 text-sm font-bold text-slate-800">Section {currentSectionIdx + 1} details</h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className={labelCls}>Section name</label>
                    <input className={sectionCls} value={currentSection.section_name}
                      onChange={(event) => updateSectionField(currentSectionIdx, 'section_name', event.target.value)} required />
                  </div>
                  <div>
                    <label className={labelCls}>Category</label>
                    <select className={sectionCls}
                      value={categories.includes(currentSection.section_category) ? currentSection.section_category : '__custom__'}
                      onChange={(event) => updateSectionField(currentSectionIdx, 'section_category', event.target.value === '__custom__' ? '' : event.target.value)}>
                      {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                      <option value="__custom__">Add new category...</option>
                    </select>
                    {!categories.includes(currentSection.section_category) && (
                      <input className={`${sectionCls} mt-2`} value={currentSection.section_category}
                        onChange={(event) => updateSectionField(currentSectionIdx, 'section_category', event.target.value)}
                        placeholder="Enter new category" required />
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Section weight (%)</label>
                    <input className={sectionCls} type="number" min="0.01" max="100" step="0.01"
                      value={currentSection.section_weight}
                      onChange={(event) => updateSectionField(currentSectionIdx, 'section_weight', event.target.value)} required />
                  </div>
                </div>
                <p className={`mt-3 text-xs font-semibold ${sectionDetailsValid ? 'text-emerald-700' : 'text-amber-700'}`}>
                  Total section weight: {totalWeight}% / 100%
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
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
                          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                              Guidance for the auditor
                            </label>
                            <p className="mb-2 text-xs text-slate-500">
                              Explain what to check or how to answer this question.
                            </p>
                            <textarea
                              rows={3}
                              placeholder="For example: Check that the seal is intact and record any visible damage."
                              className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              value={q.instructions || ''}
                              onChange={(e) =>
                                updateQuestion(currentSectionIdx, qIdx, 'instructions', e.target.value)
                              }
                            />
                          </div>
                        )}

                      <div className="grid grid-cols-2 gap-3">
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
                      </div>

                      {getResponseScores(q.response_type).length > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="mb-1 text-xs font-semibold text-slate-700">
                            Response scoring
                          </p>
                          <p className="mb-2 text-[11px] text-slate-500">
                            N/A responses are excluded from the score.
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {getResponseScores(q.response_type).map((item) => (
                              <div
                                key={item.label}
                                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                              >
                                <p className="text-[11px] text-slate-500">{item.label}</p>
                                <p className="text-sm font-semibold text-slate-800">
                                  {item.score === 'Excluded' ? item.score : `${item.score} points`}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── Scoring & Validation ── */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                          <ShieldCheck className="w-3.5 h-3.5" /> Scoring & Validation
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                          <label className="group relative flex cursor-pointer items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={q.critical_question ?? false}
                              onChange={(e) =>
                                updateQuestion(
                                  currentSectionIdx,
                                  qIdx,
                                  'critical_question',
                                  e.target.checked
                                )
                              }
                              className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                            />
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                              <AlertTriangle className="h-3 w-3" />
                              Critical
                              <HelpCircle className="h-3 w-3 text-rose-400" />
                            </span>
                            <span className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-64 rounded-lg bg-slate-900 px-3 py-2 text-[11px] leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                              A critical question covers a high-risk requirement. A failed answer may
                              need immediate action or escalation.
                            </span>
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
                      

                      {q.response_type === 'PHOTO' && (
                      <div>
                        <label className="mb-2 block text-[11px] font-semibold text-slate-400">
                          Allowed Evidence Types
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {EVIDENCE_TYPES.map((type) => {
                            const Icon = type.icon;
                            const isSelected = (q.allowed_evidence || []).includes(type.value);

                            return (
                              <button
                                key={type.value}
                                type="button"
                                onClick={() =>
                                  toggleEvidenceType(currentSectionIdx, qIdx, type.value)
                                }
                                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                                  isSelected
                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                    : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                                }`}
                              >
                                <Icon className="h-3.5 w-3.5" />
                                <span>{type.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
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
                  {submitting ? 'Saving...' : 'Save Changes'}
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
