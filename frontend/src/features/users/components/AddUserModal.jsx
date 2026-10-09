import React, { useState } from 'react';
import { Loader2, X, Mail, User, Shield } from 'lucide-react';
import { ROLE_OPTIONS } from '../../../shared/config/Roles';
import ClusterFields from '../../../shared/components/ClusterFields';
import { supabase } from '../../../shared/lib/supabaseClient'; // 1. Import your local data store client

export default function AddUserModal({ locations = [], onClose, onCreated }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: 'AUDITOR',
    home_cluster: '',
    additional_cluster: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [userCreated, setUserCreated] = useState(false);

  const assignPanIndiaForms = async (auditor) => {
    const publishedTemplateIds = new Set();
    for (let start = 0; ; start += 1000) {
      const { data, error: readError } = await supabase.from('schedules')
        .select('template_id, schedule_id')
        .eq('location_id', 'All Locations')
        .range(start, start + 999);
      if (readError) throw readError;
      (data || []).forEach((row) => {
        if (String(row.schedule_id || '').startsWith('PUB-')) publishedTemplateIds.add(row.template_id);
      });
      if ((data || []).length < 1000) break;
    }

    const createdAt = new Date().toISOString();
    const assignments = [...publishedTemplateIds].map((templateId, index) => ({
      schedule_id: `PUB-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      template_id: templateId,
      location_id: 'All Locations',
      city: '',
      frequency: 'ONE_TIME',
      run_date: createdAt.slice(0, 10),
      due_date: null,
      assigned_auditor: auditor.full_name,
      assigned_auditor_email: auditor.email,
      priority: 'MEDIUM',
      created_at: createdAt
    }));
    if (assignments.length) {
      const { error: assignmentError } = await supabase.from('schedules').insert(assignments);
      if (assignmentError) throw assignmentError;
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.home_cluster) {
      setError('Home Cluster is mandatory.');
      return;
    }

    setError('');
    setSubmitting(true);

    const payload = {
      user_id: `USR-${Date.now()}`,
      full_name: formData.full_name,
      email: formData.email,
      role: formData.role,
      home_cluster: formData.home_cluster,
      additional_cluster: formData.additional_cluster,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let insertedUser = false;
    try {
      // 2. Insert into the local data store users table
      const { error: insertError } = await supabase
        .from('users')
        .insert([payload]);

      if (insertError) throw insertError;

      insertedUser = true;
      setUserCreated(true);
      if (String(payload.role).toUpperCase().includes('AUDITOR')) {
        await assignPanIndiaForms(payload);
      }

      setSubmitting(false);
      onCreated?.();
      onClose();

    } catch (err) {
      console.error('Error adding user:', err);
      // More specific error handling (e.g. unique constraint on email)
      if (err.code === '23505') {
        setError('A user with this email address already exists.');
      } else {
        setError(insertedUser
          ? `User added, but Pan India forms could not be assigned: ${err.message || 'unknown error'}. Use Assign auditors on the form.`
          : err.message || 'Could not add user. Please try again.');
      }
      setSubmitting(false);
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
            <h2 className="text-lg font-black text-slate-900">Add User &amp; Assign Role</h2>
          </div>

          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
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
                placeholder="e.g. John Doe"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 pl-8 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                placeholder="user@company.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 pl-8 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 pl-8 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
              disabled={submitting}
              className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type={userCreated ? 'button' : 'submit'}
              onClick={userCreated ? () => { onCreated?.(); onClose(); } : undefined}
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{userCreated ? 'Close' : 'Add User'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
