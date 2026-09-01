import React, { useState } from 'react';
import { Loader2, AlertTriangle, X } from 'lucide-react';

export default function DeleteUserModal({ user, onClose, onDeleted }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      user_id: user?.user_id || '',
      email: user?.email || '',
      full_name: user?.full_name || user?.name || ''
    };

    if (typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler((response) => {
          setSubmitting(false);
          // If GAS returned a custom error object: { success: false, message: "..." }
          if (response && response.success === false) {
            setError(response.message || 'Failed to delete user.');
            return;
          }
          if (onDeleted) onDeleted();
          onClose();
        })
        .withFailureHandler((err) => {
          console.error('Error deleting user:', err);
          setSubmitting(false);
          setError(err?.message || 'Server error occurred while deleting.');
        })
        .apiDeleteUser(payload);
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
      <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-xl text-center">
        <div className="flex justify-end">
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <h3 className="text-base font-black text-slate-900">Delete User Account</h3>
        <p className="text-xs text-slate-500 mt-1">
          Are you sure you want to delete <span className="font-bold text-slate-800">{user?.full_name || user?.name || user?.email}</span>? This action cannot be undone.
        </p>

        {error && (
          <div className="mt-3 p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-[11px] font-semibold text-left">
            ⚠️ {error}
          </div>
        )}

        <div className="flex justify-center gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 flex items-center gap-2 shadow-md shadow-rose-500/20 disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Confirm Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}