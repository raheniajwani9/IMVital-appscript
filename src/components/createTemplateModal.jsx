import React, { useState, useMemo } from 'react';
import { Loader2, X, Plus, Trash2, HelpCircle } from 'lucide-react';

const RESPONSE_TYPES = [
  { value: 'YES_NO', label: 'YES / NO' },
  { value: 'PASS_FAIL', label: 'PASS / FAIL' },
  { value: 'PHOTO', label: 'PHOTO EVIDENCE' },
  { value: 'TEXT', label: 'TEXT ENTRY' },
  { value: 'NUMBER', label: 'NUMBER' },
  { value: 'RATING', label: 'RATING (1-5)' }
];

const AUDIT_TYPES = [
  'Internal Audit',
  'External Audit',
  'Safety & Compliance',
  'Process / Operational',
  'Spot Check'
];

export default function CreateTemplateModal({ existingTemplates = [], onClose, onCreated }) {
  const dynamicCategories = useMemo(() => {
    const defaultCats = ['Operations', 'Food Safety & Hygiene', 'Cold Chain Compliance', 'Safety & Maintenance'];
    const extracted = existingTemplates.map((t) => t.template_category).filter(Boolean);
    return Array.from(new Set([...defaultCats, ...extracted]));
  }, [existingTemplates]);

  const [categories, setCategories] = useState(dynamicCategories);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  const [formData, setFormData] = useState({
    template_name: '',
    template_code: '',
    template_category: categories[0] || 'Operations',
    template_description: '',
    audit_type: 'Internal Audit',
    template_owner_id: '',
    applicable_locations: 'All Locations',
    effective_date: new Date().toISOString().split('T')[0],
    template_status: 'Published',
    estimated_minutes: 15,
    sections: [
      {
        section_name: 'General Inspection',
        section_order: 1,
        questions: [{ question_text: '', response_type: 'YES_NO', points: 1, instructions: '', showInstructions: false }]
      }
    ]
  });

  const [submitting, setSubmitting] = useState(false);

  const handleAddCustomCategory = () => {
    if (!newCategoryInput.trim()) return;
    const addedCat = newCategoryInput.trim();
    if (!categories.includes(addedCat)) setCategories((prev) => [...prev, addedCat]);
    setFormData((prev) => ({ ...prev, template_category: addedCat }));
    setNewCategoryInput('');
    setIsAddingCategory(false);
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addSection = () => {
    setFormData((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        {
          section_name: `Section ${prev.sections.length + 1}`,
          section_order: prev.sections.length + 1,
          questions: [{ question_text: '', response_type: 'YES_NO', points: 1, instructions: '', showInstructions: false }]
        }
      ]
    }));
  };

  const removeSection = (sIdx) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== sIdx)
    }));
  };

  const updateSectionName = (sIdx, value) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((sec, i) => (i === sIdx ? { ...sec, section_name: value } : sec))
    }));
  };

  const addQuestion = (sIdx) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((sec, i) =>
        i === sIdx
          ? {
              ...sec,
              questions: [
                ...sec.questions,
                { question_text: '', response_type: 'YES_NO', points: 1, instructions: '', showInstructions: false }
              ]
            }
          : sec
      )
    }));
  };

  const updateQuestion = (sIdx, qIdx, field, value) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((sec, i) => {
        if (i !== sIdx) return sec;
        const updatedQs = sec.questions.map((q, j) => (j === qIdx ? { ...q, [field]: value } : q));
        return { ...sec, questions: updatedQs };
      })
    }));
  };

  const toggleQuestionInstructions = (sIdx, qIdx) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((sec, i) => {
        if (i !== sIdx) return sec;
        const updatedQs = sec.questions.map((q, j) =>
          j === qIdx ? { ...q, showInstructions: !q.showInstructions } : q
        );
        return { ...sec, questions: updatedQs };
      })
    }));
  };

  const removeQuestion = (sIdx, qIdx) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((sec, i) => {
        if (i !== sIdx) return sec;
        return { ...sec, questions: sec.questions.filter((_, j) => j !== qIdx) };
      })
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const cleanedPayload = {
      ...formData,
      estimated_minutes: Number(formData.estimated_minutes) || 0,
      sections: formData.sections.map((sec, secIdx) => ({
        ...sec,
        section_order: secIdx + 1,
        questions: sec.questions
          .filter((q) => q.question_text.trim() !== '')
          .map((q) => ({
            ...q,
            points: Number(q.points) || 0,
            template_instructions: q.instructions || formData.template_instructions || ''
          }))
      }))
    };

    setSubmitting(true);

    if (typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler(() => {
          setSubmitting(false);
          if (onCreated) onCreated();
          onClose();
        })
        .withFailureHandler((err) => {
          console.error('Error creating template:', err);
          setSubmitting(false);
        })
        .apiCreateTemplate(cleanedPayload);
    } else {
      setTimeout(() => {
        setSubmitting(false);
        if (onCreated) onCreated();
        onClose();
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold text-blue-600 tracking-wider uppercase">New Standard</span>
            <h2 className="text-lg font-black text-slate-900">Create Checklist Standard</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Header Metadata Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Template Code</label>
              <input
                required
                placeholder="e.g. IMV-DSR-001"
                type="text"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 font-semibold"
                value={formData.template_code}
                onChange={(e) => handleChange('template_code', e.target.value)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-600 uppercase">Category</label>
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(!isAddingCategory)}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-700"
                >
                  {isAddingCategory ? 'Select List' : '+ Custom Category'}
                </button>
              </div>

              {isAddingCategory ? (
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="Enter Category"
                    className="w-full bg-white border border-blue-500 rounded-lg p-2 text-xs font-semibold"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomCategory}
                    className="bg-blue-600 text-white text-xs font-bold px-3 rounded-lg hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold"
                  value={formData.template_category}
                  onChange={(e) => handleChange('template_category', e.target.value)}
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Template Name</label>
              <input
                required
                placeholder="e.g. Daily Store Readiness Checklist"
                type="text"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium"
                value={formData.template_name}
                onChange={(e) => handleChange('template_name', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Status</label>
              <select
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold"
                value={formData.template_status}
                onChange={(e) => handleChange('template_status', e.target.value)}
              >
                <option value="Published">Published</option>
                <option value="Draft">Draft</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Audit Type</label>
              <select
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold"
                value={formData.audit_type}
                onChange={(e) => handleChange('audit_type', e.target.value)}
              >
                {AUDIT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Owner / Manager ID</label>
              <input
                type="text"
                placeholder="e.g. MGR-104"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium"
                value={formData.template_owner_id}
                onChange={(e) => handleChange('template_owner_id', e.target.value)}
              />
            </div>
          </div>

          {/* Sections & Questions Builder */}
          <div className="pt-3 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Sections & Questions ({formData.sections.length})
              </h4>
              <button
                type="button"
                onClick={addSection}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" /> Add Section
              </button>
            </div>

            {formData.sections.map((sec, sIdx) => (
              <div key={sIdx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                  <input
                    type="text"
                    required
                    placeholder="Section Name..."
                    className="font-bold text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 w-full"
                    value={sec.section_name}
                    onChange={(e) => updateSectionName(sIdx, e.target.value)}
                  />
                  {formData.sections.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSection(sIdx)}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {sec.questions.map((q, qIdx) => (
                    <div key={qIdx} className="bg-white border border-slate-200/80 rounded-xl p-3 space-y-2">
                      {/* Top Bar of Question Card with "Add Instruction" on the Right */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400">
                          Q{qIdx + 1}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleQuestionInstructions(sIdx, qIdx)}
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors"
                          >
                            <HelpCircle className="w-3 h-3" />
                            <span>{q.showInstructions || q.instructions ? 'Edit Instruction' : '+ Add Instruction'}</span>
                          </button>

                          {sec.questions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeQuestion(sIdx, qIdx)}
                              className="p-0.5 text-slate-400 hover:text-rose-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
=
                      <input
                        required
                        placeholder="Question details..."
                        type="text"
                        className="w-full bg-slate-50/50 border border-slate-200 rounded-lg p-2 text-xs font-medium"
                        value={q.question_text}
                        onChange={(e) => updateQuestion(sIdx, qIdx, 'question_text', e.target.value)}
                      />

                      {(q.showInstructions || q.instructions) && (
                        <div className="pt-1">
                          <input
                            type="text"
                            placeholder="Add specific instructions for this question..."
                            className="w-full bg-blue-50/40 border border-blue-200/80 rounded-lg p-2 text-xs text-slate-700 font-medium placeholder:text-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            value={q.instructions || ''}
                            onChange={(e) => updateQuestion(sIdx, qIdx, 'instructions', e.target.value)}
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="w-full bg-slate-50/50 border border-slate-200 rounded-lg p-1.5 text-xs font-semibold"
                          value={q.response_type}
                          onChange={(e) => updateQuestion(sIdx, qIdx, 'response_type', e.target.value)}
                        >
                          {RESPONSE_TYPES.map((rt) => (
                            <option key={rt.value} value={rt.value}>
                              {rt.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="Points"
                          className="w-full bg-slate-50/50 border border-slate-200 rounded-lg p-1.5 text-xs font-semibold"
                          value={q.points}
                          onChange={(e) => updateQuestion(sIdx, qIdx, 'points', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => addQuestion(sIdx)}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Question to Section
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 shadow-md"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Template</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}