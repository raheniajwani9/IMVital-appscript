import React, { useState, useMemo } from 'react';
import { UserPlus, Search, Mail, Shield, CheckCircle2, MoreHorizontal, Pencil, Trash2, ChevronLeft, ChevronRight, User } from 'lucide-react';
import AddUserModal from '../components/AddUserModal';
import UpdateUserModal from '../components/UpdateUserModal';
import DeleteUserModal from '../components/DeleteUserModal';

const ITEMS_PER_PAGE = 10;

export default function UsersView({ users = [], onRefreshData }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const toggleMenu = (e, id) => {
    e.stopPropagation();
    setActiveMenuId(activeMenuId === id ? null : id);
  };

  const handleEdit = (e, user) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setEditingUser(user);
  };

  const handleDelete = (e, user) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setDeletingUser(user);
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        (u.full_name || u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q) ||
        (u.user_id || '').toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6 font-sans text-slate-800" onClick={() => setActiveMenuId(null)}>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-blue-600 tracking-wider uppercase">User Management</span>
          <h1 className="text-3xl font-black text-slate-900 mt-1 tracking-tight">Auditors & Personnel</h1>
          <p className="text-sm text-slate-500 mt-1">Manage platform users, auditors, and authorization roles.</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-all"
        >
          <UserPlus className="w-4 h-4" /> Add Auditor
        </button>
      </div>

      <div className="flex items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search auditors by name, email, or role..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-4 py-1.5 text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
        <div className="text-xs font-bold text-slate-500 pr-2">
          Total Users: <span className="text-slate-900 font-extrabold">{filteredUsers.length}</span>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center space-y-3">
          <User className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="text-sm font-bold text-slate-800">No Auditors Registered</div>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">Add auditor accounts to assign inspection tasks.</p>
          <button
            onClick={() => setIsAddOpen(true)}
            className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
          >
            + Add First Auditor
          </button>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center space-y-2">
          <Search className="w-8 h-8 text-slate-300 mx-auto" />
          <div className="text-sm font-bold text-slate-800">No Matching Users Found</div>
          <p className="text-xs text-slate-400">Try adjusting your search query "{searchQuery}"</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <th className="p-4">User Details</th>
                <th className="p-4">Email Address</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {paginatedUsers.map((u, idx) => {
                const uid = u.user_id || u.email || idx;
                const isMenuOpen = activeMenuId === uid;

                return (
                  <tr key={uid} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-blue-600 text-xs">
                          {(u.full_name || u.name || u.email || 'A').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{u.full_name || u.name || 'Unnamed User'}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{u.user_id || `USER-${idx + 1}`}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                        <Mail className="w-3.5 h-3.5 text-slate-400" /> {u.email}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                        <Shield className="w-3 h-3 text-slate-400" /> {u.role || 'AUDITOR'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-1 font-bold text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {u.active === false ? 'INACTIVE' : 'ACTIVE'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                        <button
                        onClick={(e) => handleEdit(e, u)}
                        title="Edit User"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                        <Pencil className="w-4 h-4" />
                        </button>
                        <button
                        onClick={(e) => handleDelete(e, u)}
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
                Showing <span className="text-slate-800">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
                <span className="text-slate-800">{Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)}</span> of{' '}
                <span className="text-slate-800">{filteredUsers.length}</span> auditors
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
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
                ))}
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
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
          onClose={() => setIsAddOpen(false)}
          onCreated={onRefreshData}
        />
      )}

      {editingUser && (
        <UpdateUserModal
          user={editingUser}
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