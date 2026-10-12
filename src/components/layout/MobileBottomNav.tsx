/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  ClipboardList,
  Layers,
  Menu,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const MobileBottomNav: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    setIsMobileMenuOpen,
  } = useApp();

  const mainTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'market_watch', label: 'Market', icon: TrendingUp },
    { id: 'orders', label: 'Orders', icon: ClipboardList },
    { id: 'positions', label: 'Positions', icon: Layers },
  ] as const;

  return (
    <nav 
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-[#0b101b]/95 backdrop-blur-md border-t border-[#1a2336] z-30 flex items-center justify-around px-2 select-none"
    >
      {mainTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors cursor-pointer ${
              isActive ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400 scale-110' : 'text-slate-400'} transition-transform`} />
            <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'font-bold text-white' : ''}`}>
              {tab.label}
            </span>
          </button>
        );
      })}

      {/* Menu Drawer Opener */}
      <button
        onClick={() => setIsMobileMenuOpen(true)}
        className="flex flex-col items-center justify-center py-1 px-3 rounded-lg text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        aria-label="Open full workspace navigation menu"
      >
        <Menu className="w-4 h-4 text-slate-400" />
        <span className="text-[10px] mt-0.5 font-medium">Menu</span>
      </button>
    </nav>
  );
};
