import React, { useState } from 'react';
import { LayoutDashboard, FileText, Plus, Tag, Settings } from 'lucide-react';
import CreateCategoryModal from './CreateCategoryModal';

export default function Sidebar({ activeTab, setActiveTab, onRefreshData }) {
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 min-h-screen p-4 flex flex-col justify-between">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 py-3 border-b border-slate-800">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-sm">
            IM
          </div>
          <span className="font-bold text-white tracking-wide text-sm">IM VITALS</span>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1">
          <button
            onClick={() => setActiveTab('templates')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'templates'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Templates</span>
          </button>

          {/* Category Trigger item in Sidebar */}
          <div className="pt-4 border-t border-slate-800/60">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Management
              </span>
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                title="Add New Category"
                className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-blue-400 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 transition-all"
            >
              <div className="flex items-center gap-3">
                <Tag className="w-4 h-4 text-blue-400" />
                <span>Add Category</span>
              </div>
              <Plus className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        </nav>
      </div>

      {/* Render Sidebar Modal */}
      {isCategoryModalOpen && (
        <CreateCategoryModal
          onClose={() => setIsCategoryModalOpen(false)}
          onCreated={() => {
            if (onRefreshData) onRefreshData();
          }}
        />
      )}
    </aside>
  );
}