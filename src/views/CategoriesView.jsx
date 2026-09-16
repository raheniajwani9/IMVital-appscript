import React, { useState, useMemo } from 'react';
import { Tag, Plus, Pencil, Trash2, Search, Loader2 } from 'lucide-react';
import CreateCategoryModal from '../components/createCategoryModal';
import { supabase } from '../supabaseClient'; // Import Supabase client

export default function CategoriesView({ questionBank = [], onRefreshData }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Group categories and compute associated template/question counts
  const categoriesList = useMemo(() => {
    const defaultCategories = ['Operations', 'Food Safety & Hygiene', 'Cold Chain Compliance', 'Safety & Maintenance'];
    
    // Extract non-empty categories used in the question bank/templates
    const usedCategories = questionBank
      .map((item) => item.template_category)
      .filter(Boolean);

    // Place dynamic/newly created categories FIRST, followed by defaults
    const uniqueUsed = Array.from(new Set(usedCategories)).reverse();
    const allCategoryNames = Array.from(new Set([...uniqueUsed, ...defaultCategories]));

    return allCategoryNames.map((catName, index) => {
      // Strictly match rows assigned to this specific category
      const associatedRows = questionBank.filter(
        (q) => q.template_category === catName
      );
      
      // Filter out undefined/null IDs so empty values aren't counted as 1 template
      const validTemplates = associatedRows
        .map((q) => q.template_id || q.template_code)
        .filter(Boolean);

      const uniqueTemplates = new Set(validTemplates).size;

      return {
        id: `CAT-${index + 1}`,
        name: catName,
        templateCount: uniqueTemplates,
        questionCount: associatedRows.length,
        status: 'Active'
      };
    });
  }, [questionBank]);

  const filteredCategories = categoriesList.filter((cat) =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteCategory = async (catName) => {
    if (window.confirm(`Are you sure you want to delete the "${catName}" category? Associated templates will be marked as "Uncategorized".`)) {
      setIsDeleting(true);
      try {
        // Bulk update templates that used this category to a null/uncategorized state
        const { error } = await supabase
          .from('templates')
          .update({ template_category: 'Uncategorized' })
          .eq('template_category', catName);

        if (error) throw error;
        
        if (onRefreshData) onRefreshData();
      } catch (err) {
        console.error('Error deleting category:', err);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className="space-y-6 font-sans text-slate-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-blue-600 tracking-wider uppercase">
            Taxonomy & Metadata
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5 tracking-tight">
            Categories
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Organize checklist templates into standardized operational categories.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      {/* Categories Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search categories..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <span className="text-xs font-bold text-slate-400">
            Total Categories: {filteredCategories.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] uppercase tracking-wider font-bold text-slate-400">
                <th className="py-3 px-6">Category Name</th>
                <th className="py-3 px-6">Linked Templates</th>
                <th className="py-3 px-6">Total Questions</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400 italic">
                    No categories found.
                  </td>
                </tr>
              ) : (
                filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-800 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Tag className="w-4 h-4" />
                      </div>
                      <span>{cat.name}</span>
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-600">
                      <span className="bg-slate-100 px-2.5 py-1 rounded-md text-[11px]">
                        {cat.templateCount} {cat.templateCount === 1 ? 'Template' : 'Templates'}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-600">
                      <span className="bg-slate-100 px-2.5 py-1 rounded-md text-[11px]">
                        {cat.questionCount} {cat.questionCount === 1 ? 'Question' : 'Questions'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200/60 uppercase">
                        {cat.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingCategory(cat)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Category"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.name)}
                          disabled={isDeleting}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete Category"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {isAddOpen && (
        <CreateCategoryModal
          onClose={() => setIsAddOpen(false)}
          onCreated={() => {
            if (onRefreshData) onRefreshData();
          }}
        />
      )}

      {/* Edit Modal */}
      {editingCategory && (
        <EditCategoryDialog
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
          onUpdated={() => {
            if (onRefreshData) onRefreshData();
          }}
        />
      )}
    </div>
  );
}

function EditCategoryDialog({ category, onClose, onUpdated }) {
  const [newName, setNewName] = useState(category.name);
  const [submitting, setSubmitting] = useState(false);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setSubmitting(true);
    try {
      // Bulk update the category name in the templates table
      const { error } = await supabase
        .from('templates')
        .update({ template_category: newName.trim() })
        .eq('template_category', category.name);

      if (error) throw error;

      if (onUpdated) onUpdated();
      onClose();
    } catch (err) {
      console.error('Error updating category:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-xl">
        <h3 className="text-base font-bold text-slate-900 border-b pb-2">Edit Category</h3>
        <form onSubmit={handleUpdate} className="mt-4 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
              Category Name
            </label>
            <input
              required
              type="text"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Update Category</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}