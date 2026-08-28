import React, { useState, useEffect } from 'react';
import { Loader2, X, Plus, Trash2 } from 'lucide-react';

const RESPONSE_TYPES = [
  { value: 'YES_NO', label: 'YES / NO' },
  { value: 'PASS_FAIL', label: 'PASS / FAIL' },
  { value: 'PHOTO', label: 'PHOTO EVIDENCE' },
  { value: 'TEXT', label: 'TEXT ENTRY' },
  { value: 'NUMBER', label: 'NUMBER' },
  { value: 'RATING', label: 'RATING (1-5)' }
];

export default function UpdateTemplateModal({ template, onClose, onUpdated }) {
  const [formData, setFormData] = useState({
    template_id: '',
    template_name: '',
    template_code: '',
    template_category: 'Operations',
    template_description: '',
    template_status: 'Draft',
    estimated_minutes: 15,
    sections: []
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!template) return;

    let parsedSections = [];

    if (Array.isArray(template.sections) && template.sections.length > 0) {
      parsedSections = template.sections.map((sec, i) => ({
        section_name: sec.section_name || `Section ${i + 1}`,
        section_order: sec.section_order || i + 1,
        questions: Array.isArray(sec.questions) && sec.questions.length > 0
          ? sec.questions.map((q) => ({
              question_text: q.question_text || q.help_text || '',
              response_type: q.response_type || 'YES_NO',
              points: Number(q.points) || 1
            }))
          : [{ question_text: '', response_type: 'YES_NO', points: 1 }]
      }));
    } 
    else if (Array.isArray(template.questions) && template.questions.length > 0) {
      // Group flat questions by section_name dynamically
      const sectionsMap = template.questions.reduce((acc, q) => {
        const secName = q.section_name || 'General Inspection';
        if (!acc[secName]) {
          acc[secName] = {
            section_name: secName,
            section_order: q.section_order || 1,
            questions: []
          };
        }
        acc[secName].questions.push({
          question_text: q.question_text || q.help_text || '',
          response_type: q.response_type || 'YES_NO',
          points: Number(q.points) || 1
        });
        return acc;
      }, {});

      parsedSections = Object.values(sectionsMap);
    } 
    else {
      parsedSections = [
        {
          section_name: template.section_name || 'General Inspection',
          section_order: template.section_order || 1,
          questions: [
            {
              question_text: template.question_text || template.help_text || '',
              response_type: template.response_type || 'YES_NO',
              points: Number(template.points) || 1
            }
          ]
        }
      ];
    }

    setFormData({
      template_id: template.template_id || template.id || template.template_code,
      template_name: template.template_name || template.section_name || '',
      template_code: template.template_code || '',
      template_category: template.template_category || 'Operations',
      template_description: template.template_description || template.section_instructions || '',
      template_status: template.template_status || 'Draft',
      estimated_minutes: Number(template.estimated_minutes) || 15,
      sections: parsedSections
    });
  }, [template]);

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
          questions: [{ question_text: '', response_type: 'YES_NO', points: 1 }]
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
      sections: prev.sections.map((sec, i) =>
        i === sIdx ? { ...sec, section_name: value } : sec
      )
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
                { question_text: '', response_type: 'YES_NO', points: 1 }
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
        const updatedQs = sec.questions.map((q, j) =>
          j === qIdx ? { ...q, [field]: value } : q
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
        return {
          ...sec,
          questions: sec.questions.filter((_, j) => j !== qIdx)
        };
      })
    }));
  };

  const totalPoints = formData.sections.reduce((acc, sec) => {
    return acc + sec.questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);
  }, 0);

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
          .map((q) => ({ ...q, points: Number(q.points) || 0 }))
      }))
    };

    setSubmitting(true);

    if (typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler(() => {
          setSubmitting(false);
          if (onUpdated) onUpdated();
          onClose();
        })
        .withFailureHandler((err) => {
          console.error('Error updating template:', err);
          setSubmitting(false);
        })
        .apiUpdateTemplate(cleanedPayload);
    } else {
      setTimeout(() => {
        setSubmitting(false);
        if (onUpdated) onUpdated();
        onClose();
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold text-blue-600 tracking-wider uppercase">Edit Mode</span>
            <h2 className="text-lg font-black text-slate-900">Update Standard Template</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Template Code</label>
              <input
                required
                type="text"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={formData.template_code}
                onChange={(e) => handleChange('template_code', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Category</label>
              <select
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={formData.template_category}
                onChange={(e) => handleChange('template_category', e.target.value)}
              >
                <option value="Operations">Operations</option>
                <option value="Food Safety">Food Safety & Hygiene</option>
                <option value="Cold Chain">Cold Chain Compliance</option>
                <option value="Safety">Safety & Maintenance</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Template Name</label>
              <input
                required
                type="text"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={formData.template_name}
                onChange={(e) => handleChange('template_name', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Status</label>
              <select
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={formData.template_status}
                onChange={(e) => handleChange('template_status', e.target.value)}
              >
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Description</label>
            <textarea
              rows="2"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={formData.template_description}
              onChange={(e) => handleChange('template_description', e.target.value)}
            ></textarea>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Est. Duration (Mins)</label>
              <input
                type="number"
                min="1"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs focus:outline-none"
                value={formData.estimated_minutes}
                onChange={(e) => handleChange('estimated_minutes', Number(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-end justify-end">
              <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-3 py-2 rounded-xl">
                Total Score: {totalPoints} pts
              </span>
            </div>
          </div>

          {/* Dynamic Sections Builder */}
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
                    className="font-bold text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none text-slate-800 w-full"
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

                <div className="space-y-2">
                  {sec.questions.map((q, qIdx) => (
                    <div key={qIdx} className="bg-white border border-slate-200/80 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-slate-400">
                          Q{qIdx + 1}
                        </span>
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

                      <input
                        required
                        placeholder="Question details..."
                        type="text"
                        className="w-full bg-slate-50/50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none"
                        value={q.question_text}
                        onChange={(e) => updateQuestion(sIdx, qIdx, 'question_text', e.target.value)}
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="w-full bg-slate-50/50 border border-slate-200 rounded-lg p-1.5 text-xs focus:outline-none"
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
                          className="w-full bg-slate-50/50 border border-slate-200 rounded-lg p-1.5 text-xs font-semibold focus:outline-none"
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
              className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 shadow-md shadow-blue-600/30"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Update Template</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}