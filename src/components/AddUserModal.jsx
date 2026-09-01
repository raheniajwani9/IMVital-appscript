import React, { useState } from 'react';
import { Loader2, X, Mail, User, Shield } from 'lucide-react';

export default function AddUserModal({ onClose, onCreated }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: 'AUDITOR'
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      user_id: `USR-${Date.now()}`,
      full_name: formData.full_name,
      email: formData.email,
      role: formData.role,
      created_at: new Date().toISOString()
    };

    if (typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler(() => {
          setSubmitting(false);
          if (onCreated) onCreated();
          onClose();
        })
        .withFailureHandler((err) => {
          console.error('Error adding user:', err);
          setSubmitting(false);
        })
        .apiAddUser(payload);
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
      <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold text-blue-600 tracking-wider uppercase">User Management</span>
            <h2 className="text-lg font-black text-slate-900">Add New Auditor</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Full Name</label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="e.g. John Doe"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-8 font-semibold text-slate-800"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
              <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Email Address</label>
            <div className="relative">
              <input
                type="email"
                required
                placeholder="auditor@company.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-8 font-semibold text-slate-800"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Role</label>
            <div className="relative">
              <select
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-8 font-semibold text-slate-800"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                <option value="AUDITOR">AUDITOR</option>
                <option value="ADMIN">ADMIN</option>
                <option value="MANAGER">MANAGER</option>
              </select>
              <Shield className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
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
              <span>Add Auditor</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}