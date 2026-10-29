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
  MessageSquare,
  Send,
  Plus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { SettingsState } from '../../types';

export const SettingsView: React.FC = () => {
  const { showToast, currentUser, tenantBranding, isLiveMode, isCompactMode, setIsCompactMode, updateUserSettings } = useApp();

  const [activeSection, setActiveSection] = useState<
    'profile' | 'security' | 'notifications' | 'tables' | 'support' | 'broker_config'
  >('profile');

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [settings, setSettings] = useState<SettingsState>({
    profileImage: '',
    displayName: 'Rohan Sen',
    organization: 'NexTrade Securities',
    email: 'rohan.sen@nextrade.example',
    phone: '+91 98765 42048',
    timezone: 'IST (UTC +05:30)',
    currency: 'INR - Indian Rupee',
    activityAlerts: true,
    compactTableDensity: isCompactMode,
    twoFactorAuth: true,
    emailNotifications: true,
    marginCallAlerts: true,
  });

  const [initialSettings, setInitialSettings] = useState<SettingsState>(settings);
  const [isSaving, setIsSaving] = useState(false);

  // Support Tickets State
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketCategory, setNewTicketCategory] = useState('General Support');
  const [newTicketMessage, setNewTicketMessage] = useState('');
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  useEffect(() => {
    if (activeSection === 'support') {
      api.getTickets().then((data) => {
        setTickets(data);
        if (data.length > 0 && !selectedTicketId) {
          setSelectedTicketId(data[0].id);
        }
      }).catch(() => {});
    }
  }, [activeSection]);

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !replyMessage.trim()) return;
    setIsSubmittingReply(true);
    try {
      const res = await api.replyTicket(selectedTicketId, replyMessage.trim());
      setTickets((prev) =>
        prev.map((t) => (t.id === selectedTicketId ? res.ticket : t))
      );
      setReplyMessage('');
      showToast('Reply posted successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to post reply', 'error');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketSubject.trim() || !newTicketMessage.trim()) {
      showToast('Subject and message are required', 'error');
      return;
    }
    setIsSubmittingTicket(true);
    try {
      const res = await api.submitTicket({
        category: newTicketCategory,
        subject: newTicketSubject.trim(),
        message: newTicketMessage.trim(),
      });
      if (res.ticket) {
        setTickets((prev) => [res.ticket, ...prev]);
        setSelectedTicketId(res.ticket.id);
      }
      setNewTicketSubject('');
      setNewTicketMessage('');
      setIsCreatingTicket(false);
      showToast('Support ticket created successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to create ticket', 'error');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) || tickets[0];

  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s);
      setInitialSettings(s);
      if (s.compactTableDensity !== undefined) {
        setIsCompactMode(Boolean(s.compactTableDensity));
      }
    }).catch(() => {});
  }, [setIsCompactMode]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image file must be under 2MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setSettings((prev) => ({ ...prev, profileImage: dataUrl }));
        showToast('Profile image updated', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.updateSettings(settings);
      setInitialSettings(settings);
      if (settings.compactTableDensity !== undefined) {
        setIsCompactMode(Boolean(settings.compactTableDensity));
      }
      updateUserSettings(settings);
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
                  <div className="w-14 h-14 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-bold flex items-center justify-center text-lg shadow-inner overflow-hidden">
                    {settings.profileImage ? (
                      <img src={settings.profileImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      currentUser?.avatar || 'RS'
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Profile image</div>
                    <div className="text-[11px] text-slate-400">JPG or PNG. Maximum size 2MB</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-[#131b2e] border border-[#1e2a42] hover:bg-slate-800 text-xs font-medium text-slate-200 hover:text-white transition-colors cursor-pointer inline-flex items-center"
                >
                  <input
                    id="profile-image-upload"
                    type="file"
                    ref={fileInputRef}
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
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
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSettings({ ...settings, compactTableDensity: checked });
                      setIsCompactMode(checked);
                    }}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-800 cursor-pointer"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setSettings(initialSettings);
                    if (initialSettings.compactTableDensity !== undefined) {
                      setIsCompactMode(Boolean(initialSettings.compactTableDensity));
                    }
                    showToast('Changes discarded', 'info');
                  }}
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

          {activeSection === 'tables' && (
            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white">Table Preferences</h3>
                <p className="text-xs text-slate-400 mt-0.5">Control row density across high-frequency tabular views.</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div>
                    <div className="text-xs font-semibold text-white">Compact table density</div>
                    <div className="text-[11px] text-slate-400">Reduce cell padding and font height to show maximum data rows without vertical scroll</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.compactTableDensity}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSettings({ ...settings, compactTableDensity: checked });
                      setIsCompactMode(checked);
                    }}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-800 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setSettings(initialSettings);
                    if (initialSettings.compactTableDensity !== undefined) {
                      setIsCompactMode(Boolean(initialSettings.compactTableDensity));
                    }
                    showToast('Changes discarded', 'info');
                  }}
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

          {activeSection === 'notifications' && (
            <div className="py-8 text-center text-xs text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="font-semibold text-white">Configured and Active</p>
              <p className="text-slate-500 mt-1">Workspace preferences are running with system defaults.</p>
            </div>
          )}

          {activeSection === 'support' && (
            <div className="space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Support & Ticket Desk</h3>
                  <p className="text-slate-400 text-[11px]">Direct communications with operations desk and Central Admin.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatingTicket(!isCreatingTicket)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isCreatingTicket ? 'Cancel' : 'New Ticket'}</span>
                </button>
              </div>

              {isCreatingTicket && (
                <form onSubmit={handleCreateTicket} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 animate-in fade-in">
                  <div className="font-semibold text-white text-xs">Create New Support Ticket</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Category
                      </label>
                      <select
                        value={newTicketCategory}
                        onChange={(e) => setNewTicketCategory(e.target.value)}
                        className="w-full bg-[#131b2e] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      >
                        <option value="General Support">General Support</option>
                        <option value="Billing & Margin">Billing & Margin</option>
                        <option value="Trading Engine">Trading Engine</option>
                        <option value="KYC & Compliance">KYC & Compliance</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Subject
                      </label>
                      <input
                        type="text"
                        value={newTicketSubject}
                        onChange={(e) => setNewTicketSubject(e.target.value)}
                        placeholder="Brief summary of inquiry"
                        className="w-full bg-[#131b2e] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Description
                    </label>
                    <textarea
                      rows={3}
                      value={newTicketMessage}
                      onChange={(e) => setNewTicketMessage(e.target.value)}
                      placeholder="Detailed explanation of the issue or request..."
                      className="w-full bg-[#131b2e] border border-slate-700/80 rounded-lg p-2.5 text-xs text-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingTicket(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingTicket}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50"
                    >
                      {isSubmittingTicket ? 'Submitting...' : 'Submit Ticket'}
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Tickets list */}
                <div className="md:col-span-5 space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Active Tickets</div>
                  {tickets.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center text-slate-400">
                      No support tickets found.
                    </div>
                  ) : (
                    tickets.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTicketId(t.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          selectedTicketId === t.id
                            ? 'bg-indigo-950/40 border-indigo-500/60'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-mono text-[10px] text-indigo-400 font-bold">{t.id}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            t.status === 'Resolved'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-amber-500/15 text-amber-400'
                          }`}>
                            {t.status}
                          </span>
                        </div>
                        <div className="font-semibold text-white text-xs truncate">{t.subject}</div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                          <span>{t.category}</span>
                          <span>{t.replies?.length || 0} replies</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Conversation thread */}
                <div className="md:col-span-7 flex flex-col rounded-xl bg-slate-900 border border-slate-800 overflow-hidden min-h-[350px]">
                  {selectedTicket ? (
                    <>
                      <div className="p-3.5 border-b border-slate-800 bg-slate-900/90">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-white text-xs">{selectedTicket.subject}</div>
                          <span className="text-[10px] text-slate-500 font-mono">{selectedTicket.id}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">{selectedTicket.message}</div>
                        <div className="text-[10px] text-slate-500 mt-1.5">
                          Created by {selectedTicket.user?.name} · {selectedTicket.createdAt}
                        </div>
                      </div>

                      <div className="flex-1 p-3.5 space-y-3 overflow-y-auto max-h-[300px]">
                        {selectedTicket.replies && selectedTicket.replies.length > 0 ? (
                          selectedTicket.replies.map((r: any) => (
                            <div
                              key={r.id}
                              className={`p-2.5 rounded-lg text-xs ${
                                r.sender === currentUser?.name
                                  ? 'bg-indigo-900/30 border border-indigo-800/40 ml-4'
                                  : 'bg-slate-800/80 border border-slate-700/50 mr-4'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] mb-1">
                                <span className="font-bold text-indigo-300">{r.sender} ({r.role})</span>
                                <span className="text-slate-500">{r.timestamp}</span>
                              </div>
                              <p className="text-slate-200 text-[11px] leading-relaxed">{r.message}</p>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6 text-slate-500 text-xs">
                            No replies yet on this conversation.
                          </div>
                        )}
                      </div>

                      <form onSubmit={handleReplySubmit} className="p-3 border-t border-slate-800 bg-slate-950 flex gap-2">
                        <input
                          type="text"
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          placeholder="Type reply message..."
                          className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="submit"
                          disabled={isSubmittingReply || !replyMessage.trim()}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>{isSubmittingReply ? 'Sending...' : 'Reply'}</span>
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
                      Select a ticket to view replies and conversation.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
