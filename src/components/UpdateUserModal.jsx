import React, { useState } from 'react';
import { Loader2, X, Mail, User, Shield } from 'lucide-react';
import { ROLE_OPTIONS, normalizeRole } from '../constants/Roles';
import ClusterFields from './ClusterFields';

export default function UpdateUserModal({ user, locations = [], onClose, onUpdated }) {
  const [formData, setFormData] = useState({
    user_id: user?.user_id || '',
    full_name: user?.full_name || user?.name || '',
    email: user?.email || '',
    role: normalizeRole(user?.role),
    home_cluster: user?.home_cluster || '',
    additional_cluster: user?.additional_cluster || user?.additional_clusters || '',
    active: user?.active !== undefined ? user.active : true,
    created_at: user?.created_at || '',
    last_login_at: user?.last_login_at || ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!formData.home_cluster) {
      setError('Home Cluster is mandatory.');
      return;
    }

    setError('');
    setSubmitting(true);

    if (typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler(() => {
          setSubmitting(false);
          onUpdated?.();
          onClose();
        })
        .withFailureHandler((err) => {
          console.error('Error updating user:', err);
          setError(err?.message || 'Could not update user.');
          setSubmitting(false);
        })
        .apiUpdateUser(formData);
    } else {
      setTimeout(() => {
        setSubmitting(false);
        onUpdated?.();
        onClose();
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
              Role Management
            </span>
            <h2 className="text-lg font-black text-slate-900">Edit User &amp; Role</h2>
          </div>

          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
              Full Name
            </label>
            <div className="relative">
              <input
                type="text"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 pl-8 font-semibold text-slate-800"
                value={formData.full_name}
                onChange={(event) => setFormData({ ...formData, full_name: event.target.value })}
              />
              <User className="absolute left-2.5 top-3 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 pl-8 font-semibold text-slate-800"
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
              />
              <Mail className="absolute left-2.5 top-3 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
              Assign Role
            </label>
            <div className="relative">
              <select
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 pl-8 font-semibold text-slate-800"
                value={formData.role}
                onChange={(event) => setFormData({ ...formData, role: event.target.value })}
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
              <Shield className="absolute left-2.5 top-3 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          <ClusterFields
            locations={locations}
            homeCluster={formData.home_cluster}
            additionalCluster={formData.additional_cluster}
            onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
          />

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-[11px] font-bold text-rose-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
