import React, { useState, useEffect, useRef } from 'react';
import {
  ClipboardCheck,
  FileCode,
  Zap,
  Users as UsersIcon,
  RotateCw,
  Loader2,
  Tag,
  Calendar,
  User,
  Mail,
  LogOut,
  ArrowRight,
  Sparkles,
  ChevronDown,
  LayoutGrid
} from 'lucide-react';

import FormsView from './views/FormsView';
import CategoriesView from './views/CategoriesView';
import CreateFormModal from './components/CreateFormModal';
import CreateCategoryModal from './components/createCategoryModal';
import SchedulesView from './views/SchedulesView';
import UsersView from './views/UsersView';

const DEFAULT_DATA = {
  overview: { complianceScore: '0%', auditCompletion: '0%', openActionsCount: 0, highRiskActionsCount: 0, syncHealth: '100%' },
  audits: [],
  actions: [],
  questionBank: [],
  templates: [],
  schedules: [],
  users: [],
  locations: []
};

// Helper: Generates uppercase initials from full name or email
function getInitials(name = '', email = '') {
  const target = name.trim() || email.split('@')[0] || 'User';
  const parts = target.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return target.substring(0, 2).toUpperCase();
}

export default function App() {
  const [currentTab, setCurrentTab] = useState('Forms');
  const [loading, setLoading] = useState(true);

  // Profile Dropdown Toggle
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileDropdownRef = useRef(null);

  // Persistent User Authentication State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('imvitals_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Login Form States
  const [loginName, setLoginName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Modal Visibility States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const [data, setData] = useState(DEFAULT_DATA);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = () => {
    setLoading(true);
    if (typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler((result) => {
          setData({ ...DEFAULT_DATA, ...result });
          setLoading(false);
        })
        .withFailureHandler((err) => {
          console.error('Apps Script Fetch Error:', err);
          setLoading(false);
        })
        .getProgramAdminData();
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

  // Submit Login Handler
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setLoginError('');

    const trimmedName = loginName.trim();
    const trimmedEmail = loginEmail.trim();

    if (!trimmedName || !trimmedEmail) {
      setLoginError('Please enter both your full name and email address.');
      return;
    }

    setIsSubmittingLogin(true);

    if (typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler((res) => {
          setIsSubmittingLogin(false);
          if (res && res.success) {
            setCurrentUser(res.user);
            localStorage.setItem('imvitals_user', JSON.stringify(res.user));
          } else {
            setLoginError(res?.message || 'Authentication failed.');
          }
        })
        .withFailureHandler((err) => {
          setIsSubmittingLogin(false);
          setLoginError('Server error during login. Please try again.');
        })
        .apiAuthenticateUser({ name: trimmedName, email: trimmedEmail });
    } else {
      // Local Development Fallback
      setTimeout(() => {
        setIsSubmittingLogin(false);
        const mockUser = {
          name: trimmedName,
          email: trimmedEmail,
          role: 'Program Admin'
        };
        setCurrentUser(mockUser);
        localStorage.setItem('imvitals_user', JSON.stringify(mockUser));
      }, 500);
    }
  };

  // Sign Out Handler
  const handleLogout = () => {
    setIsProfileMenuOpen(false);
    setCurrentUser(null);
    localStorage.removeItem('imvitals_user');
  };


  // 1. STANDALONE LOGIN PAGE
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-6 font-sans relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-orange-600/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="flex items-center gap-3 relative z-10 max-w-7xl w-full mx-auto">
          <div className="w-10 h-10 bg-gradient-to-tr from-orange-600 to-amber-500 rounded-xl flex items-center justify-center font-black text-white text-lg shadow-lg shadow-orange-600/30">
            IM
          </div>
          <span className="font-black text-xl text-white tracking-tight">IM VITALS</span>
        </div>

        <div className="my-auto py-8 relative z-10">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full mx-auto shadow-2xl border border-white/20 space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold tracking-wider uppercase">
                <Sparkles className="w-3 h-3" /> Operations Platform
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Welcome Back
              </h1>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Enter your details to access standards, forms, and audits.
              </p>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-2xl text-rose-600 text-xs font-semibold text-center leading-normal">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={loginName}
                    onChange={(e) => setLoginName(e.target.value)}
                    className="w-full bg-slate-50/80 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-slate-50/80 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingLogin}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-3 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingLogin ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Continue to Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 text-center border-t border-slate-100">
              <span className="text-[10px] text-slate-400 font-medium">
                Protected by IM VITALS Operations Engine
              </span>
            </div>
          </div>
        </div>

        <div className="text-center text-[11px] text-slate-500 font-medium relative z-10 max-w-7xl w-full mx-auto">
          © {new Date().getFullYear()} IM VITALS Platform. All rights reserved.
        </div>
      </div>
    );
  }


  const userInitials = getInitials(currentUser.name, currentUser.email);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f7fb] text-slate-800 font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[#0a1128] text-slate-300 flex flex-col justify-between p-4 flex-shrink-0 border-r border-slate-800">
        <div>
          <div className="flex items-center gap-3 px-2 py-3 mb-4">
            <div className="w-9 h-9 bg-gradient-to-tr from-orange-600 to-amber-500 rounded-lg flex items-center justify-center font-black text-white text-base shadow-lg shadow-orange-600/30">
              IM
            </div>
            <span className="font-black text-xl text-white tracking-tight">IM VITALS</span>
          </div>

          <div className="text-[10px] font-bold text-slate-400 px-3 mb-2 tracking-widest uppercase">COMMAND CENTRE</div>
          <nav className="space-y-1">
            {[
              { name: 'Forms', icon: LayoutGrid, count: data.templates.length || data.questionBank.length },
              { name: 'Schedules', icon: Calendar, count: data.schedules?.length || 0 },
            ].map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.name}
                  onClick={() => setCurrentTab(tab.name)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    currentTab === tab.name
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <IconComponent className="w-4 h-4" />
                    <span>{tab.name}</span>
                  </div>
                  {tab.count !== undefined && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      currentTab === tab.name ? 'bg-blue-700 text-white' : 'bg-orange-500/20 text-orange-400'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="text-[10px] font-bold text-slate-400 px-3 mt-6 mb-2 tracking-widest uppercase">MANAGE</div>
          <div className="space-y-1">
            <button
              onClick={() => setCurrentTab('Users')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                currentTab === 'Users'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <UsersIcon className="w-4 h-4" />
                <span>User Console</span>
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-bold">
                {data.users.length}
              </span>
            </button>

            <button
              onClick={() => setCurrentTab('Categories')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                currentTab === 'Categories'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Tag className="w-4 h-4" />
                <span>Categories</span>
              </div>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="text-xs font-semibold text-slate-400 tracking-wide uppercase">
            IMVITALS / PROGRAM ADMIN / <span className="text-slate-800 font-extrabold">{currentTab}</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={fetchData}
              className="text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Refresh Sync</span>
            </button>
            <div className="h-4 w-[1px] bg-slate-200" />

            <div className="relative" ref={profileDropdownRef}>
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
              >
                {/* Round Avatar Container displaying Initials */}
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs border border-slate-200">
                  {userInitials}
                </div>
                <span>{currentUser.name || currentUser.email}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 top-11 w-56 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-2.5 border-b border-slate-100 space-y-0.5">
                    <p className="font-bold text-xs text-slate-900 truncate">
                      {currentUser.name || 'User'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate font-medium">
                      {currentUser.email}
                    </p>
                    <span className="inline-block mt-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200/60 font-bold text-[9px] rounded-md uppercase">
                      {currentUser.role || 'Program Admin'}
                    </span>
                  </div>

                  <div className="pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-600" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl w-full mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-96 text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <div className="text-xs font-semibold">Fetching records...</div>
            </div>
          ) : (
            <>
              {currentTab === 'Forms' && (
                <FormsView
                  data={data.templates.length > 0 ? data.templates : data.questionBank}
                  onRefreshData={fetchData}
                />
              )}
              {currentTab === 'Schedules' && (
                <SchedulesView
                  schedules={data.schedules}
                  templates={data.templates.length > 0 ? data.templates : data.questionBank}
                  locations={data.locations}
                  users={data.users}
                  onRefreshData={fetchData}
                />
              )}
              {currentTab === 'Categories' && (
                <CategoriesView
                  questionBank={data.questionBank}
                  onRefreshData={fetchData}
                />
              )}
              {currentTab === 'Users' && (
                <UsersView
                  users={data?.users || []} 
                  onRefreshData={fetchData} 
                />
              )}
            </>
          )}
        </div>
      </main>

      {isFormModalOpen && (
        <CreateFormModal
          existingForms={data.templates.length > 0 ? data.templates : data.questionBank}
          onClose={() => setIsFormModalOpen(false)}
          onCreated={fetchData}
        />
      )}

      {isCategoryModalOpen && (
        <CreateCategoryModal
          onClose={() => setIsCategoryModalOpen(false)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}
