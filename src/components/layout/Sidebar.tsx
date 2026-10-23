/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  ClipboardList,
  Layers,
  ArrowLeftRight,
  BookOpen,
  BarChart3,
  Clock,
  FileBarChart,
  SlidersHorizontal,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  Activity,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NavigationTab } from '../../types';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    currentUser,
    settings,
    tenantBranding,
    setIsSupportModalOpen,
    switchRole,
    logout,
    isRealtimeConnected,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
  } = useApp();

  const navigationItems: Array<{
    id: NavigationTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'market_watch', label: 'Market Watch', icon: TrendingUp },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'orders', label: 'Orders', icon: ClipboardList },
    { id: 'positions', label: 'Positions', icon: Layers },
    { id: 'funds', label: 'Pay-in / Pay-out', icon: ArrowLeftRight },
    { id: 'account_ledger', label: 'Account', icon: BookOpen },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'action_logs', label: 'Action Logs', icon: Clock },
    { id: 'reports', label: 'Reports', icon: FileBarChart },
    { id: 'instruments', label: 'Instruments', icon: SlidersHorizontal },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (id: NavigationTab) => {
    setActiveTab(id);
    setIsMobileMenuOpen(false);
  };

  const handleSupportClick = () => {
    setIsSupportModalOpen(true);
    setIsMobileMenuOpen(false);
  };

  const handleRoleSwitch = () => {
    const nextRole = currentUser?.role === 'broker_admin'
      ? 'super_admin'
      : (currentUser?.role === 'super_admin' ? 'trader_client' : 'broker_admin');
    switchRole(nextRole);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/75 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container: Fixed slide-over drawer on mobile (< lg), static sidebar on desktop (>= lg) */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 lg:w-64 bg-[#0c1220] border-r border-[#1a2336] flex flex-col h-screen shrink-0 select-none transition-transform duration-200 ease-in-out shadow-2xl lg:shadow-none ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="px-4 sm:px-5 py-4 border-b border-[#1a2336] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-900/30 shrink-0">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-white tracking-tight">
                  {tenantBranding?.brandName || 'NexTrade'}
                </span>
              </div>
              <span className="text-[10px] font-semibold tracking-wider text-indigo-400 uppercase block -mt-0.5">
                {tenantBranding?.platformName?.includes('OS') ? 'BROKER OS' : 'TRADING OS'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Realtime Stream Ping Indicator */}
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-[10px] text-slate-400"
              title={isRealtimeConnected ? 'Real-time WebSocket / SSE Connected' : 'Reconnecting...'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isRealtimeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="hidden sm:inline lg:hidden xl:inline">{isRealtimeConnected ? 'LIVE' : 'SYNC'}</span>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* User / Broker Identity Card */}
        <div className="p-3 mx-3 mt-3 rounded-xl bg-[#131b2e] border border-[#1e2a42] flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-bold flex items-center justify-center text-xs shrink-0 overflow-hidden">
            {settings?.profileImage ? (
              <img src={settings.profileImage} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              currentUser?.avatar || 'RS'
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-slate-100 truncate">
              {currentUser?.name || settings?.displayName || 'Rohan Sen'}
            </div>
            <div className="text-[11px] text-slate-400 truncate flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shrink-0" />
              <span className="truncate">{currentUser?.roleTitle || 'Broker Administrator'}</span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="px-3 pt-4 pb-2">
          <div className="text-[10px] font-bold text-slate-500 tracking-wider uppercase px-3 mb-1.5">
            Workspace
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 lg:py-2 rounded-lg text-xs font-medium transition-all group cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#131c30]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Support & Session Actions */}
        <div className="p-3 border-t border-[#1a2336] space-y-1">
          <button
            onClick={handleSupportClick}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-[#131c30] transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />
            <span>Contact Support</span>
          </button>

          <button
            onClick={handleRoleSwitch}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-[#131c30] transition-colors group cursor-pointer"
            title="Switch role between Broker Admin and Central Super Admin"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Activity className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors shrink-0" />
              <span className="truncate">Role Switch</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 shrink-0" />
          </button>

          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              logout();
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors group cursor-pointer"
            title="Sign out of current terminal session"
          >
            <div className="flex items-center gap-3 min-w-0">
              <LogOut className="w-4 h-4 text-rose-400/80 group-hover:text-rose-300 transition-colors shrink-0" />
              <span className="truncate">Sign Out</span>
            </div>
          </button>
        </div>
      </aside>
    </>
  );
};
