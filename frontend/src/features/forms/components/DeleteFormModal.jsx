import React, { useState } from 'react';
import { Loader2, X, Trash2, AlertTriangle, FileText } from 'lucide-react';
import { supabase } from '../../../shared/lib/supabaseClient';

export default function DeleteFormModal({ form, onClose, onDeleted }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const formId = form?.template_id || form?.template_code;
  const formName = form?.template_name || 'this form';
  const versionLabel = form?.template_version || 'v1.0';
  const isOriginalVersion = versionLabel === 'v1.0';

  const handleDelete = async () => {
    if (isOriginalVersion) {
      setError('v1.0 cannot be deleted. It is the original version of this form.');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const { error: deleteError } = await supabase.rpc('delete_current_template_version', {
        p_template_id: formId
      });

      if (deleteError) throw deleteError;

      setSubmitting(false);
      if (onDeleted) onDeleted();
      onClose();

    } catch (err) {
      console.error('Error deleting form version:', err);
      setError(err.code === 'PGRST202'
        ? 'Version deletion is not installed in Supabase yet. Apply the delete_current_template_version migration.'
        : err.message || 'Failed to delete this version.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-rose-500" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Delete Current Version</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="flex items-start gap-3 p-3.5 bg-amber-50/60 border border-amber-200/60 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-600 leading-relaxed">
              {isOriginalVersion ? (
                <>v1.0 cannot be deleted. It is the original version of this form.</>
              ) : (
                <>Delete <span className="font-semibold text-slate-800">{versionLabel}</span> of "{formName}"? The previous version will become current. This cannot be undone.</>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-700 truncate">{formName}</div>
              <div className="text-[10px] text-slate-400">ID: {formId} · Current version: {versionLabel}</div>
            </div>
          </div>

          {error && (
            <div className="text-[11px] font-bold text-rose-600">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 flex items-center gap-2 shadow-md transition-colors disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span>{submitting ? 'Deleting...' : 'Delete Current Version'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
