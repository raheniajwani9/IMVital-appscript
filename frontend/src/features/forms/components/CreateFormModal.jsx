import React, { useMemo, useState } from 'react';
import {
  Loader2,
  X,
  Plus,
  Trash2,
  HelpCircle,
  Camera,
  Layers,
  FileText,
  ChevronLeft,
  Check,
  ArrowRight,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '../../../shared/lib/supabaseClient';
import { createLegacyTemplate, isMissingTemplateFunction, saveCurrentSectionDetails } from '../api/templatePersistence';
import { publishAssignments } from '../api/publishAssignments';
import PodScopePicker from '../../../shared/components/PodScopePicker';
import { userClusters, podsForScope, podKey } from '../../../shared/config/clusters';

const RESPONSE_TYPES = [
  { value: 'YES_NO', label: 'Yes / No' },
  { value: 'PASS_FAIL', label: 'Pass / Fail' },
  { value: 'COMPLETE_NOT_COMPLETE', label: 'Complete / Not Complete' },
  { value: 'PHOTO', label: 'Photo Evidence' },
  { value: 'RATING', label: 'Rating (1–5)' }
];

const EVIDENCE_POLICIES = [
  { value: 'NONE', label: 'Not Required' },
  { value: 'OPTIONAL', label: 'Optional' },
  { value: 'MANDATORY', label: 'Always Required' },
  { value: 'MANDATORY_ON_FAIL', label: 'Required on Failure' }
];

const EVIDENCE_TYPES = [
  { value: 'PHOTO', label: 'Photo', icon: Camera }
];

const AUDIT_TYPES = [
  'Internal Audit',
  'External Audit',
  'Safety & Compliance',
  'Process / Operational',
  'Spot Check'
];

const FAILURE_RESPONSES = [
  { value: 'NONE', label: 'None — record only' },
  { value: 'FLAG', label: 'Flag as failure' },
  { value: 'MANDATORY_COMMENT', label: 'Require comment' },
  { value: 'MANDATORY_EVIDENCE', label: 'Require evidence' },
  { value: 'RAISE_NC', label: 'Raise Non-Conformance' },
  { value: 'BLOCK_SUBMIT', label: 'Block submission' }
];

const RISK_CATEGORIES = [
  'General',
  'Food Safety',
  'Fire Safety',
  'Hygiene',
  'Compliance',
  'Operational',
  'Cold Chain',
  'Infrastructure',
  'Workforce'
];

const COMMENT_REQUIREMENTS = [
  { value: 'NEVER', label: 'Never' },
  { value: 'ALWAYS', label: 'Always' },
  { value: 'ON_FAIL', label: 'On failure' },
  { value: 'ON_CRITICAL', label: 'On critical failure' },
  { value: 'ON_NA', label: 'When N/A selected' }
];

const newQuestion = () => ({
  question_text: '',
  response_type: 'YES_NO',
  evidence_policy: 'OPTIONAL',
  allowed_evidence: [],
  points: 1,
  is_required: true,
  instructions: '',
  showInstructions: false,
  scored: true,
  failure_response: 'NONE',
  critical_question: false,
  na_allowed: false,
  risk_category: 'General',
  tags: [],
  comment_required: 'NEVER'
});

const getResponseOptions = (responseType) => {
  const score = 1;

  switch (responseType) {
    case 'YES_NO':
      return [
        { label: 'Yes', score },
        { label: 'No', score: 0 },
        { label: 'N/A', score: 'Excluded' }
      ];
    case 'PASS_FAIL':
      return [
        { label: 'Pass', score },
        { label: 'Fail', score: 0 },
        { label: 'N/A', score: 'Excluded' }
      ];
    case 'COMPLETE_NOT_COMPLETE':
      return [
        { label: 'Complete', score },
        { label: 'Not Complete', score: 0 },
        { label: 'N/A', score: 'Excluded' }
      ];
    default:
      return [];
  }
};

export default function CreateFormModal({
  existingForms = [],
  locations = [],
  users = [],
  currentUser,
  onClose,
  onCreated
}) {
  const [step, setStep] = useState(0);

  const dynamicCategories = useMemo(() => {
    const defaultCats = [
      'Operations',
      'Food Safety & Hygiene',
      'Cold Chain Compliance',
      'Safety & Maintenance'
    ];
    const extracted = existingForms.flatMap((form) =>
      (form.sections || []).map((section) => section.section_category)
    ).filter(Boolean);

    return Array.from(new Set([...defaultCats, ...extracted]));
  }, [existingForms]);

  const categories = dynamicCategories;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [savedTemplateId, setSavedTemplateId] = useState(null);
  const [publishScope, setPublishScope] = useState('PAN_INDIA');
  const [selectedAuditorEmail, setSelectedAuditorEmail] = useState('');
  const [scope, setScope] = useState({ clusters: [], cities: [], pods: [] });

  const auditors = useMemo(
    () => users.filter((user) =>
      String(user.role || '').toLowerCase().includes('auditor') &&
      String(user.active).toLowerCase() !== 'false' &&
      Boolean(user.email)
    ),
    [users]
  );
  const selectedAuditor = auditors.find(
    (user) => String(user.email || '').toLowerCase() === selectedAuditorEmail.toLowerCase()
  );
  const allowedClusters = useMemo(() => userClusters(selectedAuditor), [selectedAuditor]);
  const selectedPods = useMemo(() => {
    if (!scope.pods.length) return [];
    const selected = new Set(scope.pods.map((id) => String(id).toLowerCase()));
    return podsForScope(locations, { clusters: scope.clusters, cities: scope.cities })
      .filter((pod) => selected.has(podKey(pod).toLowerCase()));
  }, [locations, scope]);

  const handleAuditorSelect = (email) => {
    const nextAuditor = auditors.find((user) => user.email === email);
    const clusters = userClusters(nextAuditor);
    setSelectedAuditorEmail(email);
    setScope({ clusters, cities: [], pods: [] });
  };

  const [formData, setFormData] = useState({
    template_name: '',
    template_category: 'Operations',
    template_description: '',
    template_instructions: '',
    audit_type: 'Internal Audit',
    template_owner_id: '',
    applicable_locations: 'All Locations',
    effective_date: new Date().toISOString().split('T')[0],
    template_status: 'Published',
    estimated_minutes: 15,
    sample_size: '',
    sections: [
      {
        section_name: 'General Inspection',
        section_category: dynamicCategories[0] || 'Operations',
        section_weight: 100,
        section_order: 1,
        section_instructions: '',
        questions: [newQuestion()]
      }
    ]
  });

  const isStep1Valid = formData.template_name.trim().length > 0;
  const totalSections = formData.sections.length;
  const totalWeight = formData.sections.reduce((total, section) => total + (Number(section.section_weight) || 0), 0);
  const sectionDetailsValid = formData.sections.every((section) =>
    section.section_name.trim() && section.section_category.trim() &&
    section.section_weight !== '' && Number(section.section_weight) > 0 && Number(section.section_weight) <= 100
  ) && Math.abs(totalWeight - 100) < 0.01;
  const totalQuestions = formData.sections.reduce(
    (count, section) => count + section.questions.length,
    0
  );
  const onFormDetails = step === 0;
  const onSection = step >= 1;
  const currentSectionIdx = step - 1;
  const onFirstSection = step === 1;
  const currentSection = onSection
    ? formData.sections[currentSectionIdx]
    : null;

  const currentSectionHasQuestions = currentSection
    ? currentSection.questions.some(
        (question) => question.question_text.trim() !== ''
      )
    : false;

  const canAddSection =
    isStep1Valid && (onFormDetails || currentSectionHasQuestions);

  const hasAnyQuestions = formData.sections.some((section) =>
    section.questions.some((question) => question.question_text.trim() !== '')
  );

  const canSaveForm = isStep1Valid && hasAnyQuestions && sectionDetailsValid;

  const handleChange = (field, value) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
  };

  const addSection = () => {
    const newSection = {
      section_name: `Section ${totalSections + 1}`,
      section_category: formData.sections[formData.sections.length - 1]?.section_category || categories[0],
      section_weight: 0,
      section_order: totalSections + 1,
      section_instructions: '',
      questions: [newQuestion()]
    };

    setFormData((previous) => ({
      ...previous,
      sections: [...previous.sections, newSection]
    }));
    setStep(totalSections + 1);
  };

  const removeSection = (sectionIndex) => {
    setFormData((previous) => {
      const sections = previous.sections.filter(
        (_, index) => index !== sectionIndex
      );
      if (step > sections.length) setStep(sections.length);
      return { ...previous, sections };
    });
  };

  const updateSectionField = (sectionIndex, field, value) => {
    setFormData((previous) => ({
      ...previous,
      sections: previous.sections.map((section, index) =>
        index === sectionIndex
          ? { ...section, [field]: value }
          : section
      )
    }));
  };

  const addQuestion = (sectionIndex) => {
    setFormData((previous) => ({
      ...previous,
      sections: previous.sections.map((section, index) =>
        index === sectionIndex
          ? {
              ...section,
              questions: [...section.questions, newQuestion()]
            }
          : section
      )
    }));
  };

  const updateQuestion = (sectionIndex, questionIndex, field, value) => {
    setFormData((previous) => ({
      ...previous,
      sections: previous.sections.map((section, currentSectionIndex) => {
        if (currentSectionIndex !== sectionIndex) return section;

        return {
          ...section,
          questions: section.questions.map((question, currentQuestionIndex) => {
            if (currentQuestionIndex !== questionIndex) return question;

            const updatedQuestion = { ...question, [field]: value };

            if (field === 'response_type' && value !== 'PHOTO') {
              updatedQuestion.allowed_evidence = [];
            }

            return updatedQuestion;
          })
        };
      })
    }));
  };

  const toggleEvidenceType = (sectionIndex, questionIndex, evidenceValue) => {
    setFormData((previous) => ({
      ...previous,
      sections: previous.sections.map((section, currentSectionIndex) => {
        if (currentSectionIndex !== sectionIndex) return section;

        return {
          ...section,
          questions: section.questions.map((question, currentQuestionIndex) => {
            if (currentQuestionIndex !== questionIndex) return question;

            const currentEvidence = question.allowed_evidence || [];
            const isSelected = currentEvidence.includes(evidenceValue);

            return {
              ...question,
              allowed_evidence: isSelected
                ? currentEvidence.filter((item) => item !== evidenceValue)
                : [...currentEvidence, evidenceValue]
            };
          })
        };
      })
    }));
  };

  const toggleInstructions = (sectionIndex, questionIndex) => {
    setFormData((previous) => ({
      ...previous,
      sections: previous.sections.map((section, currentSectionIndex) => {
        if (currentSectionIndex !== sectionIndex) return section;

        return {
          ...section,
          questions: section.questions.map((question, currentQuestionIndex) =>
            currentQuestionIndex === questionIndex
              ? {
                  ...question,
                  showInstructions: !question.showInstructions
                }
              : question
          )
        };
      })
    }));
  };

  const removeQuestion = (sectionIndex, questionIndex) => {
    setFormData((previous) => ({
      ...previous,
      sections: previous.sections.map((section, currentSectionIndex) =>
        currentSectionIndex === sectionIndex
          ? {
              ...section,
              questions: section.questions.filter(
                (_, index) => index !== questionIndex
              )
            }
          : section
      )
    }));
  };

  const handleSubmit = async (event) => {
    if (event?.preventDefault) event.preventDefault();
    if (publishScope === 'TARGETED' && (!selectedAuditor || !selectedPods.length)) {
      setError('Select an auditor and at least one location for a targeted form.');
      setStep(0);
      return;
    }
    if (publishScope === 'PAN_INDIA' && auditors.length === 0) {
      setError('There are no active auditors to publish this form to.');
      setStep(0);
      return;
    }
    if (!isStep1Valid) {
      setStep(0);
      return;
    }
    if (!hasAnyQuestions) {
      setStep(1);
      return;
    }
    if (!sectionDetailsValid) {
      setError('Enter a name and category for every section, and make section weights total 100%.');
      setStep(1);
      return;
    }

    setError('');
    setSubmitting(true);
    const templateId = savedTemplateId || `TMP-${Date.now()}`;
    let templateSaved = Boolean(savedTemplateId);

    try {
      const storedUserString = localStorage.getItem('imvitals_user');
      let creatorName = 'System Admin';

      if (storedUserString) {
        try {
          const storedUser = JSON.parse(storedUserString);
          if (storedUser?.name) creatorName = storedUser.name;
        } catch (parseError) {
          console.error('Error parsing user data from local storage', parseError);
        }
      }

      if (!templateSaved) {
        const { data: createdVersion, error: createError } = await supabase.rpc(
          'create_template_with_initial_version',
          {
            p_template: {
              template_id: templateId,
              template_name: formData.template_name,
              template_category: formData.template_category,
              template_description: formData.template_description,
              estimated_minutes: Number(formData.estimated_minutes) || 15
            },
            p_sections: formData.sections,
            p_actor: creatorName
          }
        );

        if (createError) {
          if (!isMissingTemplateFunction(createError, 'create_template_with_initial_version')) {
            throw createError;
          }
          await createLegacyTemplate(supabase, templateId, formData, creatorName);
        } else {
          console.info('Created template version:', createdVersion?.template_version);
        }
        templateSaved = true;
        setSavedTemplateId(templateId);
      }

      await saveCurrentSectionDetails(supabase, templateId, formData.sections);

      await publishAssignments({
        supabase, templateId, publishScope, locations, auditors, selectedAuditor, selectedPods
      });

      setSubmitting(false);
      onCreated?.();
      onClose();
    } catch (submitError) {
      console.error('Error creating form:', submitError);
      setError(templateSaved
        ? `Form saved, but publishing could not finish: ${submitError.message || 'Unknown error'}. Apply the section-details migration if it has not been applied, then retry Publish.`
        : submitError.message || 'Failed to create form.');
      if (templateSaved) onCreated?.();
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';
  const labelCls = 'mb-1.5 block text-xs font-semibold text-slate-500';
  const sectionCls =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="shrink-0 border-b border-slate-100 px-6 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                <FileText className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Create New Form</h2>
                <p className="text-xs text-slate-400">
                  Build your checklist step by step
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {error && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2 text-[11px] font-semibold text-rose-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              {error}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
            <div className="flex shrink-0 items-center gap-2">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  step >= 0
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {step > 0 ? <Check className="h-4 w-4" /> : '1'}
              </div>
              <span className="whitespace-nowrap text-xs font-semibold text-slate-800">
                Details
              </span>
            </div>

            {formData.sections.map((section, index) => (
              <React.Fragment key={section.section_order ?? index}>
                <div
                  className={`h-0.5 w-6 shrink-0 rounded-full transition-colors ${
                    step > index ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                />
                <div className="flex shrink-0 items-center gap-2">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      step > index + 1
                        ? 'bg-indigo-600 text-white'
                        : step === index + 1
                          ? 'bg-indigo-600 text-white ring-2 ring-indigo-200'
                          : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {step > index + 1 ? <Check className="h-4 w-4" /> : index + 2}
                  </div>
                  <span className="whitespace-nowrap text-xs font-semibold text-slate-700">
                    {section.section_name?.length > 18
                      ? `${section.section_name.slice(0, 18)}…`
                      : section.section_name || `Section ${index + 1}`}
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5">
          {onFormDetails && (
            <div className="space-y-5">
              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100">
                  <span className="text-xs font-bold text-indigo-600">1</span>
                </div>
                <h3 className="text-sm font-bold text-slate-700">Form Details</h3>
                <span className="ml-1 text-xs text-slate-400">
                  — Basic information about this form
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPublishScope('PAN_INDIA')}
                  className={`rounded-xl border p-4 text-left transition-colors ${publishScope === 'PAN_INDIA' ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <span className="block text-sm font-bold text-slate-800">Publish Pan India</span>
                  <span className="mt-1 block text-xs text-slate-500">Make this form available to all auditors across locations.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPublishScope('TARGETED')}
                  className={`rounded-xl border p-4 text-left transition-colors ${publishScope === 'TARGETED' ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <span className="block text-sm font-bold text-slate-800">Publish for a specific scope</span>
                  <span className="mt-1 block text-xs text-slate-500">Choose an auditor, clusters, cities, and locations.</span>
                </button>
              </div>

              {publishScope === 'TARGETED' && (
                <div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
                  <label className={labelCls}>Auditor</label>
                  <select
                    required
                    className={sectionCls}
                    value={selectedAuditorEmail}
                    onChange={(event) => handleAuditorSelect(event.target.value)}
                  >
                    <option value="">Select an auditor</option>
                    {auditors.map((auditor) => (
                      <option key={auditor.user_id || auditor.email} value={auditor.email}>
                        {auditor.full_name || auditor.name || auditor.email}
                      </option>
                    ))}
                  </select>
                  <PodScopePicker
                    locations={locations}
                    allowedClusters={allowedClusters}
                    value={scope}
                    onChange={setScope}
                    auditorName={selectedAuditor?.full_name || selectedAuditor?.name || ''}
                    label="Cluster, city, and location scope"
                  />
                </div>
              )}

              <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                <div>
                  <label className={labelCls}>
                    Form Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Daily Store Readiness Checklist"
                    className={inputCls}
                    value={formData.template_name}
                    onChange={(event) =>
                      handleChange('template_name', event.target.value)
                    }
                  />
                  {!isStep1Valid && (
                    <p className="mt-1 text-[11px] font-medium text-rose-400">
                      Form name is required to continue
                    </p>
                  )}
                </div>

                <div>
                    <label className={labelCls}>Audit Type</label>
                    <select
                      className={sectionCls}
                      value={formData.audit_type}
                      onChange={(event) =>
                        handleChange('audit_type', event.target.value)
                      }
                    >
                      {AUDIT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Estimated Minutes</label>
                    <input
                      type="number"
                      min="1"
                      className={sectionCls}
                      value={formData.estimated_minutes}
                      onChange={(event) =>
                        handleChange('estimated_minutes', event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label className={labelCls}>
                      Sample Size (SKU Count){' '}
                      <span className="text-[10px] font-normal text-slate-400">
                        (optional)
                      </span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 50"
                      className={sectionCls}
                      value={formData.sample_size}
                      onChange={(event) =>
                        handleChange('sample_size', event.target.value)
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Description</label>
                  <textarea
                    rows={2}
                    placeholder="Brief description of what this form is for..."
                    className={inputCls}
                    value={formData.template_description}
                    onChange={(event) =>
                      handleChange('template_description', event.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {onSection && currentSection && (
            <div className="space-y-5">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100">
                  <Layers className="h-4 w-4 text-indigo-600" />
                </div>
                <h3 className="text-sm font-bold text-slate-700">
                  {currentSection.section_name || 'Untitled Section'}
                </h3>
                <span className="text-xs text-slate-400">
                  Section {currentSectionIdx + 1} of {totalSections}
                </span>
                <span className="text-xs text-slate-400">
                  — Add questions for this section
                </span>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
                <h4 className="mb-3 text-sm font-bold text-slate-800">Section {currentSectionIdx + 1} details</h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className={labelCls}>Section name</label>
                    <input className={sectionCls} value={currentSection.section_name}
                      onChange={(event) => updateSectionField(currentSectionIdx, 'section_name', event.target.value)}
                      placeholder="e.g. Store hygiene" required />
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

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  {totalSections > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSection(currentSectionIdx)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                      aria-label="Remove section"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-3 p-4">
                  {currentSection.questions.map((question, questionIndex) => {
                    const responseOptions = getResponseOptions(question.response_type);

                    return (
                      <div
                        key={questionIndex}
                        className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-600">
                              {questionIndex + 1}
                            </span>
                            <span className="text-sm font-semibold text-slate-700">
                              Question {questionIndex + 1}
                            </span>
                            {question.critical_question && (
                              <span className="flex items-center gap-0.5 rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-700">
                                <AlertTriangle className="h-3 w-3" />
                                Critical
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <label className="flex cursor-pointer items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={question.is_required}
                                onChange={(event) =>
                                  updateQuestion(
                                    currentSectionIdx,
                                    questionIndex,
                                    'is_required',
                                    event.target.checked
                                  )
                                }
                                className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="text-[11px] font-semibold text-slate-500">
                                Required
                              </span>
                            </label>

                            <button
                              type="button"
                              onClick={() =>
                                toggleInstructions(currentSectionIdx, questionIndex)
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:border-indigo-200 hover:bg-indigo-100"
                            >
                              <HelpCircle className="h-3.5 w-3.5" />
                              {question.showInstructions || question.instructions
                                ? 'Edit guidance'
                                : 'Add guidance'}
                            </button>

                            {currentSection.questions.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  removeQuestion(currentSectionIdx, questionIndex)
                                }
                                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                                aria-label={`Remove question ${questionIndex + 1}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <input
                          required
                          type="text"
                          placeholder="Type your question here..."
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          value={question.question_text}
                          onChange={(event) =>
                            updateQuestion(
                              currentSectionIdx,
                              questionIndex,
                              'question_text',
                              event.target.value
                            )
                          }
                        />

                        {(question.showInstructions || question.instructions) && (
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
                              value={question.instructions}
                              onChange={(event) =>
                                updateQuestion(
                                  currentSectionIdx,
                                  questionIndex,
                                  'instructions',
                                  event.target.value
                                )
                              }
                            />
                          </div>
                        )}

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                              Answer Type
                            </label>
                            <select
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              value={question.response_type}
                              onChange={(event) =>
                                updateQuestion(
                                  currentSectionIdx,
                                  questionIndex,
                                  'response_type',
                                  event.target.value
                                )
                              }
                            >
                              {RESPONSE_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                              Evidence
                            </label>
                            <select
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              value={question.evidence_policy || 'OPTIONAL'}
                              onChange={(event) =>
                                updateQuestion(
                                  currentSectionIdx,
                                  questionIndex,
                                  'evidence_policy',
                                  event.target.value
                                )
                              }
                            >
                              {EVIDENCE_POLICIES.map((policy) => (
                                <option key={policy.value} value={policy.value}>
                                  {policy.label}
                                </option>
                              ))}
                            </select>
                          </div>

                        </div>

                        {responseOptions.length > 0 && (
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="mb-2">
                              <p className="text-xs font-semibold text-slate-700">
                                Response scoring
                              </p>
                              <p className="text-[11px] text-slate-500">
                                N/A responses are excluded from the score.
                              </p>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                              {responseOptions.map((option) => (
                                <div
                                  key={option.label}
                                  className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                                >
                                  <p className="text-[11px] text-slate-500">
                                    {option.label}
                                  </p>
                                  <p className="text-sm font-semibold text-slate-800">
                                    {option.score === 'Excluded'
                                      ? option.score
                                      : `${option.score} points`}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Scoring &amp; Validation
                          </div>

                          <div className="flex flex-wrap items-center gap-4">
                            <label className="group relative flex cursor-pointer items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={question.critical_question}
                                onChange={(event) =>
                                  updateQuestion(
                                    currentSectionIdx,
                                    questionIndex,
                                    'critical_question',
                                    event.target.checked
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
                                A critical question covers a high-risk requirement.
                                A failed answer may need immediate action or escalation.
                              </span>
                            </label>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div>
                              <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                                Failure Response
                              </label>
                              <select
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                value={question.failure_response || 'NONE'}
                                onChange={(event) =>
                                  updateQuestion(
                                    currentSectionIdx,
                                    questionIndex,
                                    'failure_response',
                                    event.target.value
                                  )
                                }
                              >
                                {FAILURE_RESPONSES.map((response) => (
                                  <option key={response.value} value={response.value}>
                                    {response.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                                Risk Category
                              </label>
                              <select
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                value={question.risk_category || 'General'}
                                onChange={(event) =>
                                  updateQuestion(
                                    currentSectionIdx,
                                    questionIndex,
                                    'risk_category',
                                    event.target.value
                                  )
                                }
                              >
                                {RISK_CATEGORIES.map((category) => (
                                  <option key={category} value={category}>
                                    {category}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                                Comment Required
                              </label>
                              <select
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                value={question.comment_required || 'NEVER'}
                                onChange={(event) =>
                                  updateQuestion(
                                    currentSectionIdx,
                                    questionIndex,
                                    'comment_required',
                                    event.target.value
                                  )
                                }
                              >
                                {COMMENT_REQUIREMENTS.map((requirement) => (
                                  <option
                                    key={requirement.value}
                                    value={requirement.value}
                                  >
                                    {requirement.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                              Tags{' '}
                              <span className="font-normal normal-case text-slate-300">
                                (comma separated)
                              </span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. fire, extinguisher, emergency"
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              value={(question.tags || []).join(', ')}
                              onChange={(event) =>
                                updateQuestion(
                                  currentSectionIdx,
                                  questionIndex,
                                  'tags',
                                  event.target.value
                                    .split(',')
                                    .map((tag) => tag.trim())
                                    .filter(Boolean)
                                )
                              }
                            />
                          </div>
                        </div>

                        {question.response_type === 'PHOTO' && (
                          <div>
                            <label className="mb-2 block text-[11px] font-semibold text-slate-400">
                              Allowed Evidence Types
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {EVIDENCE_TYPES.map((type) => {
                                const Icon = type.icon;
                                const isSelected = (
                                  question.allowed_evidence || []
                                ).includes(type.value);

                                return (
                                  <button
                                    key={type.value}
                                    type="button"
                                    onClick={() =>
                                      toggleEvidenceType(
                                        currentSectionIdx,
                                        questionIndex,
                                        type.value
                                      )
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
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => addQuestion(currentSectionIdx)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 py-2 text-xs font-semibold text-slate-400 transition-all hover:border-indigo-300 hover:text-indigo-600"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Question
                  </button>
                </div>
              </div>

              {!currentSectionHasQuestions && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
                  <HelpCircle className="h-4 w-4 shrink-0 text-amber-500" />
                  <p className="text-xs font-medium text-amber-700">
                    Add at least one question to this section before adding a new
                    section or saving.
                  </p>
                </div>
              )}
            </div>
          )}
        </form>

        <div className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-white px-6 py-4">
          <div>
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100"
              >
                <ChevronLeft className="h-4 w-4" />
                {onFirstSection ? 'Back to Details' : 'Previous Section'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onFormDetails && (
              <button
                type="button"
                disabled={!isStep1Valid}
                onClick={() => setStep(1)}
                className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition-all ${
                  isStep1Valid
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-700'
                    : 'cursor-not-allowed bg-slate-100 text-slate-400'
                }`}
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            )}

            {onSection && (
              <>
                <button
                  type="button"
                  disabled={!canAddSection}
                  onClick={addSection}
                  title={
                    !canAddSection
                      ? !isStep1Valid
                        ? 'Fill form details first'
                        : 'Add at least one question first'
                      : 'Add a new section'
                  }
                  className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                    canAddSection
                      ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                      : 'cursor-not-allowed bg-slate-50 text-slate-300'
                  }`}
                >
                  <Plus className="h-4 w-4" />
                  Add Section
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !canSaveForm}
                  title={!canSaveForm ? 'Add at least one question first' : 'Save the form'}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-500/20 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? 'Publishing...' : savedTemplateId ? 'Retry Publish' : 'Publish'}
                </button>
              </>
            )}
          </div>
        </div>

        {onSection && (
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-2 text-center">
            <p className="text-xs text-slate-400">
              {totalQuestions} question(s) across {totalSections} section(s)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
