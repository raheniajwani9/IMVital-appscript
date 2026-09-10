import React, { useState, useEffect, useRef } from 'react';
import {
  RotateCw,
  LogOut,
  ChevronDown,
  Loader2,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { getRoleLabel } from '../constants/Roles';

const COLLAPSE_KEY = 'imvitals_sidebar_collapsed';

// Helper: Generates uppercase initials from full name or email
function getInitials(name = '', email = '') {
  const target = String(name).trim() || String(email).split('@')[0] || 'User';
  const parts = target.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return target.substring(0, 2).toUpperCase();
}

/**
 * Shared chrome for every role: sidebar, header, breadcrumb, refresh, profile menu.
 * Role-specific screens are passed in as `children`.
 *
 * Sidebar behaviour:
 *  - Desktop (lg+): docked, and collapsible to an icon-only rail. Choice is remembered.
 *  - Mobile/tablet: off-canvas drawer opened by the header hamburger, closed by the
 *    backdrop, the X button, Escape, or picking a nav item.
 */
export default function AppShell({
  currentUser,
  navConfig,
  currentTab,
  onTabChange,
  counts = {},
  breadcrumbTitle,
  loading = false,
  loadingLabel = 'Fetching records...',
  onRefresh,
  onLogout,
  children
}) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === 'true';
    } catch (e) {
      return false;
    }
  });

  const profileDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Escape closes whichever overlay is open.
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== 'Escape') return;
      setIsDrawerOpen(false);
      setIsProfileMenuOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch (e) {
        /* storage unavailable — collapse still works for this session */
      }
      return next;
    });
  };

  const handleTabClick = (key) => {
    onTabChange(key);
    setIsDrawerOpen(false);
  };

  // `isCollapsed` is a desktop-only concern: inside the mobile drawer the
  // sidebar is always full width, so every collapse style is gated behind `lg:`.
  const hideWhenRail = isCollapsed ? 'lg:hidden' : '';

  const userInitials = getInitials(currentUser?.name, currentUser?.email);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f7fb] text-slate-800 font-sans">
      {/* Mobile drawer backdrop */}
      {isDrawerOpen && (
        <div
          onClick={() => setIsDrawerOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 flex flex-col bg-[#0a1128] text-slate-300 p-4 flex-shrink-0 border-r border-slate-800 overflow-y-auto transition-all duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        } ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Brand + close/collapse controls */}
        <div
          className={`flex items-center gap-3 px-2 py-3 mb-4 ${
            isCollapsed ? 'lg:px-0 lg:justify-center' : ''
          }`}
        >
          <div className="w-9 h-9 bg-gradient-to-tr from-orange-600 to-amber-500 rounded-lg flex items-center justify-center font-black text-white text-base shadow-lg shadow-orange-600/30 shrink-0">
            IM
          </div>
          <span className={`font-black text-xl text-white tracking-tight ${hideWhenRail}`}>
            IM VITALS
          </span>

          {/* Close drawer (mobile only) */}
          <button
            onClick={() => setIsDrawerOpen(false)}
            aria-label="Close navigation"
            className="ml-auto p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1">
          {navConfig.groups.map((group, groupIndex) => (
            <div key={group.title}>
              <div
                className={`text-[10px] font-bold text-slate-400 px-3 mb-2 tracking-widest uppercase ${
                  groupIndex > 0 ? 'mt-6' : ''
                } ${hideWhenRail}`}
              >
                {group.title}
              </div>

              {/* Keeps the rail visually spaced where the group title used to be */}
              {isCollapsed && groupIndex > 0 && (
                <div className="hidden lg:block mx-3 mt-4 mb-3 border-t border-slate-800" />
              )}

              <nav className="space-y-1">
                {group.items.map((item) => {
                  const IconComponent = item.icon;
                  const isActive = currentTab === item.key;
                  const count = item.countKey ? counts[item.countKey] : undefined;

                  return (
                    <button
                      key={item.key}
                      onClick={() => handleTabClick(item.key)}
                      title={isCollapsed ? item.name : undefined}
                      className={`group relative w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        isCollapsed ? 'lg:justify-center lg:px-0' : ''
                      } ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                      }`}
                    >
                      <div
                        className={`flex items-center gap-3 ${
                          isCollapsed ? 'lg:gap-0' : ''
                        }`}
                      >
                        <span className="relative shrink-0">
                          <IconComponent className="w-4 h-4" />
                          {/* Rail-mode count indicator */}
                          {isCollapsed && count > 0 && (
                            <span
                              className={`hidden lg:block absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full ring-2 ring-[#0a1128] ${
                                isActive ? 'bg-white' : 'bg-orange-400'
                              }`}
                            />
                          )}
                        </span>
                        <span className={hideWhenRail}>{item.name}</span>
                      </div>

                      {count !== undefined && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${hideWhenRail} ${
                            isActive
                              ? 'bg-blue-700 text-white'
                              : item.mutedCount
                              ? 'bg-slate-800 text-slate-400'
                              : 'bg-orange-500/20 text-orange-400'
                          }`}
                        >
                          {count}
                        </span>
                      )}

                      {/* Hover tooltip while collapsed */}
                      {isCollapsed && (
                        <span className="hidden lg:block absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-bold whitespace-nowrap border border-slate-700 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                          {item.name}
                          {count !== undefined && (
                            <span className="ml-1.5 text-orange-400">{count}</span>
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={toggleCollapsed}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`hidden lg:flex items-center gap-3 mt-4 px-3.5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-800/60 hover:text-slate-300 transition-all cursor-pointer ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4 shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between gap-3 px-4 lg:px-8 sticky top-0 z-20">
          <div className="flex items-center gap-2 min-w-0">
            {/* Open drawer (mobile only) */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Open navigation"
              className="p-2 -ml-1 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer lg:hidden shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="text-xs font-semibold text-slate-400 tracking-wide uppercase truncate">
              <span className="hidden sm:inline">IMVITALS / {navConfig.breadcrumb} / </span>
              <span className="text-slate-800 font-extrabold">{breadcrumbTitle || currentTab}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <button
              onClick={onRefresh}
              title="Refresh Sync"
              className="text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Refresh Sync</span>
            </button>
            <div className="hidden sm:block h-4 w-[1px] bg-slate-200" />

            <div className="relative" ref={profileDropdownRef}>
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-lg transition-colors flex items-center gap-2 cursor-pointer max-w-[45vw] sm:max-w-none"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs border border-slate-200">
                  {userInitials}
                </div>
                <span className="hidden sm:inline truncate">
                  {currentUser?.name || currentUser?.email}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${
                    isProfileMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 top-11 w-56 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-2.5 border-b border-slate-100 space-y-0.5">
                    <p className="font-bold text-xs text-slate-900 truncate">
                      {currentUser?.name || 'User'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate font-medium">
                      {currentUser?.email}
                    </p>
                    <span className="inline-block mt-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200/60 font-bold text-[9px] rounded-md uppercase">
                      {getRoleLabel(currentUser?.role)}
                    </span>
                  </div>

                  <div className="pt-1">
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onLogout();
                      }}
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

        <div className="p-6 max-w-7xl w-full mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-96 text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <div className="text-xs font-semibold">{loadingLabel}</div>
            </div>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}
