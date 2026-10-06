import React, { useState } from 'react';
import { LayoutDashboard, FileText, Plus, Tag, Settings, Menu, X } from 'lucide-react';
import CreateCategoryModal from '../../features/categories/components/CreateCategoryModal';

export default function Sidebar({ activeTab, setActiveTab, onRefreshData }) {
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleTabClick = (tabKey) => {
    setActiveTab(tabKey);
    setMobileMenuOpen(false); // Auto-close sidebar on mobile after choosing a tab
  };

  return (
    <>
      {/* Mobile Bar Top Header */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 text-white p-4 border-b border-slate-800 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-sm">
            IM
          </div>
          <span className="font-bold text-white tracking-wide text-sm">IM VITALS</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-colors"
          aria-label="Toggle Menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Backdrop overlay for mobile screen */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 h-screen p-4 flex flex-col justify-between transition-transform duration-300 transform
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="flex items-center justify-between px-2 py-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-sm">
                IM
              </div>
              <span className="font-bold text-white tracking-wide text-sm">IM VITALS</span>
            </div>

            {/* Mobile Explicit Close Button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Menu */}
          <nav className="space-y-1">
            <button
              onClick={() => handleTabClick('templates')}
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
                  onClick={() => {
                    setIsCategoryModalOpen(true);
                    setMobileMenuOpen(false);
                  }}
                  title="Add New Category"
                  className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-blue-400 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => {
                  setIsCategoryModalOpen(true);
                  setMobileMenuOpen(false);
                }}
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

        {/* Render Category Modal */}
        {isCategoryModalOpen && (
          <CreateCategoryModal
            onClose={() => setIsCategoryModalOpen(false)}
            onCreated={() => {
              if (onRefreshData) onRefreshData();
            }}
          />
        )}
      </aside>
    </>
  );
}
