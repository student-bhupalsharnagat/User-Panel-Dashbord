/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Bell,
  ChevronDown,
  Shield,
  User,
  Zap,
  Radio,
  Share2,
  RefreshCw,
  ExternalLink,
  Menu,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const TopBar: React.FC = () => {
  const {
    activeTab,
    currentUser,
    switchRole,
    isSearchOpen,
    setIsSearchOpen,
    isNotificationsOpen,
    setIsNotificationsOpen,
    unreadNotificationsCount,
    isLiveMode,
    setIsLiveMode,
    triggerRefresh,
    isRealtimeConnected,
    showToast,
    setIsMobileMenuOpen,
  } = useApp();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getBreadcrumbTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard';
      case 'market_watch': return 'Market Watch';
      case 'clients': return 'Clients';
      case 'client_details': return 'Client Details';
      case 'orders': return 'Orders';
      case 'positions': return 'Positions';
      case 'funds': return 'Pay-in / Pay-out';
      case 'account_ledger': return 'Account';
      case 'analytics': return 'Analytics';
      case 'action_logs': return 'Action Logs';
      case 'reports': return 'Reports';
      case 'instruments': return 'Instruments';
      case 'settings': return 'Settings';
      default: return 'Dashboard';
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast('Workspace URL copied to clipboard', 'info');
    }
  };

  return (
    <header className="h-16 bg-[#0b101b] border-b border-[#1a2336] px-3 sm:px-4 md:px-6 flex items-center justify-between gap-2 sm:gap-4 shrink-0 z-10">
      {/* Left: Mobile Menu Button & Breadcrumbs */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1.5 min-w-0">
          <div className="text-xs text-slate-500 font-medium whitespace-nowrap hidden sm:inline">
            NexTrade <span className="text-slate-600">/</span>
          </div>
          <h1 className="text-sm font-semibold text-white tracking-tight truncate">
            {getBreadcrumbTitle()}
          </h1>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* Full Search Bar for md+ screens */}
        <button
          onClick={() => setIsSearchOpen(true)}
          className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#131b2e] border border-[#1e2a42] text-xs text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all w-48 lg:w-72 xl:w-80 group text-left cursor-pointer"
        >
          <Search className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-400 shrink-0" />
          <span className="truncate flex-1">Search clients, orders...</span>
          <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-900 border border-slate-700/60 rounded text-slate-400 shrink-0">
            ⌘K
          </kbd>
        </button>

        {/* Compact Search Button for mobile (< md) */}
        <button
          onClick={() => setIsSearchOpen(true)}
          className="md:hidden p-2 rounded-lg bg-[#131b2e] border border-[#1e2a42] text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          title="Search"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Live / Demo Mode Pill */}
        <button
          onClick={() => {
            const nextMode = !isLiveMode;
            setIsLiveMode(nextMode);
            showToast(nextMode ? 'Switched to Live Engine mode' : 'Switched to Demonstration Workspace', 'info');
          }}
          className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-medium border flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
            isLiveMode
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30 hover:bg-emerald-900/40'
              : 'bg-indigo-950/40 text-indigo-300 border-indigo-500/30 hover:bg-indigo-900/40'
          }`}
          title="Toggle between Live Production Engine and Demonstration Workspace data"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isLiveMode ? 'bg-emerald-400 animate-pulse' : 'bg-indigo-400'}`} />
          <span className="hidden xs:inline sm:inline">{isLiveMode ? 'Live engine' : 'Demo data'}</span>
          <span className="xs:hidden sm:hidden">{isLiveMode ? 'Live' : 'Demo'}</span>
        </button>

        {/* Refresh button */}
        <button
          onClick={() => {
            triggerRefresh();
            showToast('Refreshed authoritative records', 'info');
          }}
          className="p-2 rounded-lg bg-[#131b2e] border border-[#1e2a42] text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          title="Force refresh authoritative database metrics"
          aria-label="Refresh data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Notification Bell */}
        <button
          onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
          className="relative p-2 rounded-lg bg-[#131b2e] border border-[#1e2a42] text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          title="Notifications and Risk Alerts"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center border-2 border-[#0b101b]">
              {unreadNotificationsCount}
            </span>
          )}
        </button>

        {/* Share Button (Laptop & Desktop) */}
        <button
          onClick={handleShare}
          className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#131b2e] border border-[#1e2a42] text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
        >
          <Share2 className="w-3.5 h-3.5 text-slate-400" />
          <span>Share</span>
        </button>

        {/* User Profile & Role Switch Dropdown */}
        <div className="relative shrink-0" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 p-1 sm:pl-2.5 rounded-lg bg-[#131b2e] border border-[#1e2a42] hover:border-slate-700 transition-colors cursor-pointer"
            aria-label="User profile and role menu"
          >
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-slate-200 leading-tight">
                {currentUser?.name || 'Rohan Sen'}
              </div>
              <div className="text-[10px] text-slate-400 leading-tight">
                {currentUser?.roleTitle || 'Broker Admin'}
              </div>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-bold flex items-center justify-center text-xs shrink-0">
              {currentUser?.avatar || 'RS'}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 mr-1 hidden sm:block" />
          </button>

          {/* Profile & Role Popover */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-24px)] rounded-xl bg-[#131b2e] border border-[#1e2a42] shadow-2xl shadow-black/80 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-2.5 border-b border-slate-800">
                <div className="text-xs font-semibold text-white">{currentUser?.name}</div>
                <div className="text-[11px] text-slate-400 truncate">{currentUser?.email}</div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] text-indigo-400 font-medium">{currentUser?.organization}</span>
                </div>
              </div>

              {/* Role Switching Selector for RBAC Testing */}
              <div className="px-3 py-2 border-b border-slate-800">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Switch Active Role (RBAC)
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      switchRole('super_admin');
                      setIsProfileOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between cursor-pointer ${
                      currentUser?.role === 'super_admin'
                        ? 'bg-indigo-600/30 text-indigo-300 font-medium'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="truncate">Super Admin (Central)</span>
                    </div>
                    {currentUser?.role === 'super_admin' && <span className="text-[10px] text-indigo-400 shrink-0">Active</span>}
                  </button>

                  <button
                    onClick={() => {
                      switchRole('master');
                      setIsProfileOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between cursor-pointer ${
                      currentUser?.role === 'master'
                        ? 'bg-indigo-600/30 text-indigo-300 font-medium'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">Master Broker (Vikramaditya)</span>
                    </div>
                    {currentUser?.role === 'master' && <span className="text-[10px] text-indigo-400 shrink-0">Active</span>}
                  </button>

                  <button
                    onClick={() => {
                      switchRole('broker_admin');
                      setIsProfileOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between cursor-pointer ${
                      currentUser?.role === 'broker_admin'
                        ? 'bg-indigo-600/30 text-indigo-300 font-medium'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">Broker Admin (Rohan Sen)</span>
                    </div>
                    {currentUser?.role === 'broker_admin' && <span className="text-[10px] text-indigo-400 shrink-0">Active</span>}
                  </button>

                  <button
                    onClick={() => {
                      switchRole('sub_broker');
                      setIsProfileOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between cursor-pointer ${
                      currentUser?.role === 'sub_broker'
                        ? 'bg-indigo-600/30 text-indigo-300 font-medium'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">Sub-Broker (Karan Mehra)</span>
                    </div>
                    {currentUser?.role === 'sub_broker' && <span className="text-[10px] text-indigo-400 shrink-0">Active</span>}
                  </button>

                  <button
                    onClick={() => {
                      switchRole('trader_client');
                      setIsProfileOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between cursor-pointer ${
                      currentUser?.role === 'trader_client'
                        ? 'bg-indigo-600/30 text-indigo-300 font-medium'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">Trader Client (Aarav Mehta)</span>
                    </div>
                    {currentUser?.role === 'trader_client' && <span className="text-[10px] text-indigo-400 shrink-0">Active</span>}
                  </button>
                </div>
              </div>

              <div className="px-2 pt-1">
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    showToast('Logged out of session', 'info');
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
                >
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
