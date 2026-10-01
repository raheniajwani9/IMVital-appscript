import React, { useMemo, useState } from 'react';
import {
  UserPlus,
  Search,
  Mail,
  Shield,
  CheckCircle2,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  User
} from 'lucide-react';

import AddUserModal from '../components/AddUserModal';
import UpdateUserModal from '../components/UpdateUserModal';
import DeleteUserModal from '../components/DeleteUserModal';
import { getRoleLabel } from '../constants/Roles';
import { userClusters } from '../constants/clusters';

const ITEMS_PER_PAGE = 10;

export default function UsersView({ users = [], locations = [], onRefreshData }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const handleEdit = (e, user) => {
    e.stopPropagation();
    setEditingUser(user);
  };

  const handleDelete = (e, user) => {
    e.stopPropagation();
    setDeletingUser(user);
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;

    const query = searchQuery.toLowerCase();

    return users.filter((user) => {
      const name = user.full_name || user.name || '';
      const email = user.email || '';
      const role = getRoleLabel(user.role);
      const userId = user.user_id || '';
      const clusters = userClusters(user).join(' ');

      return (
        name.toLowerCase().includes(query) ||
        email.toLowerCase().includes(query) ||
        role.toLowerCase().includes(query) ||
        userId.toLowerCase().includes(query) ||
        clusters.toLowerCase().includes(query)
      );
    });
  }, [users, searchQuery]);

  const unmappedCount = useMemo(
    () => users.filter((user) => !String(user.home_cluster || '').trim()).length,
    [users]
  );

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE) || 1;

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6 font-sans text-slate-800">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-blue-600 tracking-wider uppercase">
            Role Management
          </span>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Users & Roles
          </h1>

          <p className="text-sm text-slate-500 mt-1">
            Manage users, assign platform roles, and set cluster coverage.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {unmappedCount > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-700">
          {unmappedCount} user{unmappedCount > 1 ? 's have' : ' has'} no Home Cluster set —
          they will not appear in cluster-scoped auditor lists when scheduling audits.
        </div>
      )}

      <div className="flex items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />

          <input
            type="text"
            placeholder="Search users by name, email, role, or cluster..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-4 py-1.5 text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="text-xs font-bold text-slate-500 pr-2">
          Total Users:{' '}
          <span className="text-slate-900 font-extrabold">
            {filteredUsers.length}
          </span>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center space-y-3">
          <User className="w-10 h-10 text-slate-300 mx-auto" />

          <div className="text-sm font-bold text-slate-800">
            No Users Registered
          </div>

          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Add users and assign them the appropriate platform roles.
          </p>

          <button
            onClick={() => setIsAddOpen(true)}
            className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
          >
            + Add First User
          </button>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center space-y-2">
          <Search className="w-8 h-8 text-slate-300 mx-auto" />

          <div className="text-sm font-bold text-slate-800">
            No Matching Users Found
          </div>

          <p className="text-xs text-slate-400">
            Try adjusting your search query "{searchQuery}"
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <th className="p-4">User Details</th>
                <th className="p-4">Email Address</th>
                <th className="p-4">Assigned Role</th>
                <th className="p-4">Clusters</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-medium">
              {paginatedUsers.map((user, index) => {
                const userId =
                  user.user_id || user.email || `user-${index}`;

                const isActive = user.active !== false;
                const roleLabel = getRoleLabel(user.role);
                const extraClusters = userClusters(user).slice(1);

                return (
                  <tr
                    key={userId}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-blue-600 text-xs">
                          {(
                            user.full_name ||
                            user.name ||
                            user.email ||
                            'U'
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <div className="font-bold text-slate-900 text-xs">
                            {user.full_name || user.name || 'Unnamed User'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {user.email}
                      </span>
                    </td>

                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                        <Shield className="w-3 h-3 text-slate-400" />
                        {roleLabel}
                      </span>
                    </td>

                    <td className="p-4">
                      {user.home_cluster ? (
                        <div className="flex flex-wrap items-center gap-1">
                          <span
                            title="Home cluster"
                            className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700"
                          >
                            {user.home_cluster}
                          </span>

                          {extraClusters.map((cluster) => (
                            <span
                              key={cluster}
                              title="Additional cluster"
                              className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600"
                            >
                              {cluster}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-600">NOT SET</span>
                      )}
                    </td>

                    <td className="p-4">
                      <span
                        className={`flex items-center gap-1 font-bold ${
                          isActive ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(event) => handleEdit(event, user)}
                          title="Edit User Role"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        <button
                          onClick={(event) => handleDelete(event, user)}
                          title="Delete User"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
              <div className="text-[11px] font-bold text-slate-500">
                Showing{' '}
                <span className="text-slate-800">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}
                </span>{' '}
                to{' '}
                <span className="text-slate-800">
                  {Math.min(
                    currentPage * ITEMS_PER_PAGE,
                    filteredUsers.length
                  )}
                </span>{' '}
                of{' '}
                <span className="text-slate-800">
                  {filteredUsers.length}
                </span>{' '}
                users
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    setCurrentPage((page) => Math.max(page - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                  (page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        currentPage === page
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                          : 'text-slate-600 hover:bg-slate-200/60'
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}

                <button
                  onClick={() =>
                    setCurrentPage((page) =>
                      Math.min(page + 1, totalPages)
                    )
                  }
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isAddOpen && (
        <AddUserModal
          locations={locations}
          onClose={() => setIsAddOpen(false)}
          onCreated={onRefreshData}
        />
      )}

      {editingUser && (
        <UpdateUserModal
          user={editingUser}
          locations={locations}
          onClose={() => setEditingUser(null)}
          onUpdated={onRefreshData}
        />
      )}

      {deletingUser && (
        <DeleteUserModal
          user={deletingUser}
          onClose={() => setDeletingUser(null)}
          onDeleted={onRefreshData}
        />
      )}
    </div>
  );
}