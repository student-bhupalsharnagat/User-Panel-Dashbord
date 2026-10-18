/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Bell,
  Sliders,
  HelpCircle,
  Briefcase,
  Upload,
  CheckCircle2,
  Lock,
  Smartphone,
  Save,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { SettingsState } from '../../types';

export const SettingsView: React.FC = () => {
  const { showToast, currentUser, tenantBranding, isLiveMode } = useApp();

  const [activeSection, setActiveSection] = useState<
    'profile' | 'security' | 'notifications' | 'tables' | 'support' | 'broker_config'
  >('profile');

  const [settings, setSettings] = useState<SettingsState>({
    profileImage: '',
    displayName: 'Rohan Sen',
    organization: 'NexTrade Securities',
    email: 'rohan.sen@nextrade.example',
    phone: '+91 98765 42048',
    timezone: 'IST (UTC +05:30)',
    currency: 'INR - Indian Rupee',
    activityAlerts: true,
    compactTableDensity: false,
    twoFactorAuth: true,
    emailNotifications: true,
    marginCallAlerts: true,
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => setSettings(s)).catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.updateSettings(settings);
      showToast('Settings saved successfully', 'success');
    } catch {
      showToast('Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-white">Settings</h2>
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
              isLiveMode
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
            }`}>
              {isLiveMode ? 'Live engine' : 'Sandbox mode'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage your broker profile, security, and workspace preferences.
          </p>
        </div>
      </div>

      {/* Main Settings Grid (Left Nav Tabs + Right Content Panel) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
        {/* Sub-Nav Tabs: Horizontal scrollable on mobile (< md), vertical stack on desktop (md+) */}
        <div className="md:col-span-3 flex md:flex-col overflow-x-auto no-scrollbar gap-1.5 pb-1 md:pb-0">
          {[
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'security', label: 'Security', icon: Shield },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'tables', label: 'Table preferences', icon: Sliders },
            { id: 'support', label: 'Support', icon: HelpCircle },
            { id: 'broker_config', label: 'Broker configuration', icon: Briefcase },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as any)}
                className={`whitespace-nowrap shrink-0 md:w-full flex items-center justify-between px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60 bg-[#131b2e]/60 md:bg-transparent'
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
                <span className="hidden md:inline text-slate-600 text-xs">›</span>
              </button>
            );
          })}
        </div>

        {/* Right Settings Panel Form */}
        <div className="md:col-span-9 p-4 sm:p-6 rounded-xl bg-[#111827] border border-[#1e293b] shadow-sm">
          {activeSection === 'profile' && (
            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white">Profile</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Changes apply to your administrative workspace and audit logs.
                </p>
              </div>

              {/* Profile Image Section */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-bold flex items-center justify-center text-lg shadow-inner">
                    {currentUser?.avatar || 'RS'}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Profile image</div>
                    <div className="text-[11px] text-slate-400">JPG or PNG. Maximum size 2MB</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => showToast('Image upload ready', 'info')}
                  className="px-3 py-1.5 rounded-lg bg-[#131b2e] border border-[#1e2a42] hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors"
                >
                  Change image
                </button>
              </div>

              {/* Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Broker Display Name
                  </label>
                  <input
                    type="text"
                    value={settings.displayName}
                    onChange={(e) => setSettings({ ...settings, displayName: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Organization
                  </label>
                  <input
                    type="text"
                    value={settings.organization}
                    onChange={(e) => setSettings({ ...settings, organization: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={settings.email}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Default Timezone
                  </label>
                  <select
                    value={settings.timezone}
                    onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="IST (UTC +05:30)">IST (UTC +05:30)</option>
                    <option value="UTC (UTC +00:00)">UTC (UTC +00:00)</option>
                    <option value="EST (UTC -05:00)">EST (UTC -05:00)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Default Currency
                  </label>
                  <select
                    value={settings.currency}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                    className="w-full bg-[#131b2e] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="INR - Indian Rupee">INR - Indian Rupee</option>
                    <option value="USD - US Dollar">USD - US Dollar</option>
                  </select>
                </div>
              </div>

              {/* Toggles (Page 15 Design) */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div>
                    <div className="text-xs font-semibold text-white">Trading activity alerts</div>
                    <div className="text-[11px] text-slate-400">Receive alerts for large orders and account risks</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.activityAlerts}
                    onChange={(e) => setSettings({ ...settings, activityAlerts: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-800 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div>
                    <div className="text-xs font-semibold text-white">Compact table density</div>
                    <div className="text-[11px] text-slate-400">Show more rows in data-intensive views</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.compactTableDensity}
                    onChange={(e) => setSettings({ ...settings, compactTableDensity: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-800 cursor-pointer"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => showToast('Changes discarded', 'info')}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-colors shadow-md shadow-indigo-900/30 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          )}

          {activeSection === 'security' && (
            <div className="space-y-4 text-xs">
              <h3 className="text-sm font-bold text-white">Security & Active Sessions</h3>
              <p className="text-slate-400">Configure authentication credentials and token rotation.</p>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">Two-Factor Authentication (2FA)</div>
                    <div className="text-slate-400 text-[11px]">Enforce hardware token or authenticator app for all staff</div>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-bold text-[10px]">Active</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="font-semibold text-white">Active Session Credentials</div>
                <div className="text-slate-400 text-[11px]">
                  Logged in from IP 103.48.xx.21 · Chrome Desktop (macOS) · Token expires in 11 hours
                </div>
              </div>
            </div>
          )}

          {activeSection === 'broker_config' && (
            <div className="space-y-4 text-xs">
              <h3 className="text-sm font-bold text-white">Broker Configuration & Central Admin Link</h3>
              <p className="text-slate-400">Status of server-to-server connection with Central Admin and Trading Gateway.</p>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tenant ID:</span>
                  <span className="font-mono text-white font-bold">{tenantBranding?.version ? 'TENANT-NEXTRADE-01' : 'TENANT-DEFAULT'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Brand Name:</span>
                  <span className="font-semibold text-indigo-300">{tenantBranding?.brandName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Trading Gateway Status:</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Operational (Mock & Real Adapters Ready)</span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">White-label Version:</span>
                  <span className="font-mono text-slate-300">{tenantBranding?.version}</span>
                </div>
              </div>
            </div>
          )}

          {(activeSection === 'notifications' || activeSection === 'tables' || activeSection === 'support') && (
            <div className="py-8 text-center text-xs text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="font-semibold text-white">Configured and Active</p>
              <p className="text-slate-500 mt-1">Workspace preferences are running with system defaults.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
