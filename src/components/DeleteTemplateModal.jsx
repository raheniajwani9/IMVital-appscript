import React, { useState } from 'react';
import { Loader2, AlertTriangle, X } from 'lucide-react';

export default function DeleteTemplateModal({ template, onClose, onDeleted }) {
  const [submitting, setSubmitting] = useState(false);

  const templateId = template?.template_id || template?.id || template?.template_code;
  const templateName = template?.template_name || 'this operational standard';

  const handleDelete = () => {
    if (!templateId) return;

    setSubmitting(true);

    if (typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler(() => {
          setSubmitting(false);
          if (onDeleted) onDeleted(templateId);
          onClose();
        })
        .withFailureHandler((err) => {
          console.error('Error deleting template:', err);
          setSubmitting(false);
        })
        .apiDeleteTemplate(templateId);
    } else {
      setTimeout(() => {
        setSubmitting(false);
        if (onDeleted) onDeleted(templateId);
        onClose();
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <h3 className="text-base font-bold text-slate-900">Delete Template?</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Are you sure you want to delete <span className="font-semibold text-slate-800">"{templateName}"</span>? This will permanently remove all associated checklist questions from your database.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-2 shadow-md shadow-rose-600/20 transition-all"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Delete Permanently</span>
          </button>
        </div>
      </div>
    </div>
  );
}