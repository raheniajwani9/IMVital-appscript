import React, { useState } from 'react';
import { Loader2, X, Plus, Trash2 } from 'lucide-react';

const RESPONSE_TYPES = [
  { value: 'YES_NO', label: 'YES / NO' },
  { value: 'PASS_FAIL', label: 'PASS / FAIL' },
  { value: 'PHOTO', label: 'PHOTO EVIDENCE' },
  { value: 'TEXT', label: 'TEXT ENTRY' },
  { value: 'NUMBER', label: 'NUMBER' },
  { value: 'RATING', label: 'RATING (1-5)' }
];

export default function CreateTemplateModal({ onClose, onCreated }) {
  const [formData, setFormData] = useState({
    template_name: '',
    template_code: '',
    template_category: 'Operations',
    template_description: '',
    estimated_minutes: 15,
    questions: [
      { question_text: '', response_type: 'YES_NO', points: 1 }
    ]
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addQuestion = () => {
    setFormData((prev) => ({
      ...prev,
      questions: [...prev.questions, { question_text: '', response_type: 'YES_NO', points: 1 }]
    }));
  };

  const updateQuestion = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) =>
        (i === index ? { ...q, [field]: value } : q))
    }));
  };

  const removeQuestion = (index) => {
    setFormData((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }));
  };

  const totalPoints = formData.questions.reduce(
    (sum, q) => sum + (Number(q.points) || 0), 0
  );

  const handleSubmit = (e) => {
    e.preventDefault();

    const cleaned = {
      ...formData,
      estimated_minutes: Number(formData.estimated_minutes) || 0,
      questions: formData.questions
        .filter((q) => q.question_text.trim() !== '')
        .map((q) => ({ ...q, points: Number(q.points) || 0 }))
    };

    setSubmitting(true);

    if (typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler(() => {
          setSubmitting(false);
          onCreated();
          onClose();
        })
        .withFailureHandler((err) => {
          console.error('Error creating template:', err);
          setSubmitting(false);
        })
        .apiCreateTemplate(cleaned);
    } else {
      setTimeout(() => {
        setSubmitting(false);
        onCreated();
        onClose();
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <h2 className="text-lg font-black text-slate-900">Create Checklist Standard</h2>
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
                placeholder="e.g. IMV-DSR-001"
                type="text"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold"
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

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Template Name</label>
            <input
              required
              placeholder="e.g. Daily Store Readiness Checklist"
              type="text"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
              value={formData.template_name}
              onChange={(e) => handleChange('template_name', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Description</label>
            <textarea
              rows="2"
              placeholder="Brief description of operating standards..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={formData.template_description}
              onChange={(e) => handleChange('template_description', e.target.value)}
            ></textarea>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Est. Duration (Mins)</label>
            <input
              type="number"
              min="1"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none"
              value={formData.estimated_minutes}
              onChange={(e) => handleChange('estimated_minutes', Number(e.target.value) || 0)}
            />
          </div>

          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-800">
                Inspection Questions
                <span className="ml-2 text-[10px] font-semibold text-slate-400">
                  ({formData.questions.length})
                </span>
              </h4>
              <button
                type="button"
                onClick={addQuestion}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Question
              </button>
            </div>

            <div className="mb-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center justify-between">
              <span>Points per question</span>
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                Total: {totalPoints} pts
              </span>
            </div>

            <div className="space-y-3">
              {formData.questions.map((q, index) => (
                <div
                  key={index}
                  className="bg-slate-50/60 border border-slate-200 rounded-xl p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase mt-2">
                      Q{index + 1}
                    </span>
                    {formData.questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeQuestion(index)}
                        className="p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                        title="Remove question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <input
                    required
                    placeholder={`e.g. Question ${index + 1} text...`}
                    type="text"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={q.question_text}
                    onChange={(e) => updateQuestion(index, 'question_text', e.target.value)}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={q.response_type}
                      onChange={(e) => updateQuestion(index, 'response_type', e.target.value)}
                    >
                      {RESPONSE_TYPES.map((rt) => (
                        <option key={rt.value} value={rt.value}>
                          {rt.label}
                        </option>
                      ))}
                    </select>

                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        placeholder="Points"
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none pr-7 font-semibold"
                        value={q.points}
                        onChange={(e) => updateQuestion(index, 'points', e.target.value)}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-500">
                        pts
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 shadow-md shadow-blue-600/30"
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
