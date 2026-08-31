import React, { useState } from 'react';
import { Loader2, AlertTriangle, X } from 'lucide-react';

export default function DeleteScheduleModal({ schedule, onClose, onDeleted }) {
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = () => {
    if (!schedule?.schedule_id) return;
    setSubmitting(true);

    if (typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler(() => {
          setSubmitting(false);
          if (onDeleted) onDeleted();
          onClose();
        })
        .withFailureHandler((err) => {
          console.error('Error deleting schedule:', err);
          setSubmitting(false);
        })
        .apiDeleteSchedule(schedule.schedule_id);
    } else {
      setTimeout(() => {
        setSubmitting(false);
        if (onDeleted) onDeleted();
        onClose();
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-xl text-center space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
          <span className="text-[10px] font-bold text-rose-600 tracking-wider uppercase">Confirm Deletion</span>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto text-rose-600">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div>
          <h3 className="text-base font-bold text-slate-900">Delete Audit Schedule?</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Are you sure you want to remove schedule <span className="font-mono font-bold text-slate-700">{schedule?.schedule_id}</span>? This action cannot be undone.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 flex items-center gap-2 shadow-md shadow-rose-500/20"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}