/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Shield,
  Lock,
  Mail,
  User,
  Phone,
  Building,
  CreditCard,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Zap,
  Activity,
  Briefcase,
  Terminal,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';

interface QuickCard {
  role: UserRole;
  title: string;
  subtitle: string;
  email: string;
  id: string;
  color: string;
  borderColor: string;
  bgHover: string;
  icon: React.ComponentType<{ className?: string }>;
}

const QUICK_CARDS: QuickCard[] = [
  {
    role: 'broker_admin',
    title: 'Broker Admin',
    subtitle: 'Rohan Sen',
    email: 'rohan.sen@nextrade.example',
    id: 'BRK-ROHAN-01',
    color: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    bgHover: 'hover:border-purple-500/60 hover:bg-purple-950/20',
    icon: Shield,
  },
  {
    role: 'super_admin',
    title: 'Super Admin',
    subtitle: 'Central Administrator',
    email: 'superadmin@nextrade.example',
    id: 'SUPER-ADMIN-01',
    color: 'text-rose-400',
    borderColor: 'border-rose-500/30',
    bgHover: 'hover:border-rose-500/60 hover:bg-rose-950/20',
    icon: Shield,
  },
  {
    role: 'master',
    title: 'Master Broker',
    subtitle: 'Rajesh Sharma',
    email: 'master@nextrade.example',
    id: 'MST-ALPHA-01',
    color: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    bgHover: 'hover:border-amber-500/60 hover:bg-amber-950/20',
    icon: Zap,
  },
  {
    role: 'sub_broker',
    title: 'Sub-Broker Desk',
    subtitle: 'Vikram Joshi',
    email: 'subbroker@nextrade.example',
    id: 'SUB-BRK-001',
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    bgHover: 'hover:border-emerald-500/60 hover:bg-emerald-950/20',
    icon: Briefcase,
  },
  {
    role: 'operations',
    title: 'Operations Desk',
    subtitle: 'Pooja Nair',
    email: 'operations@nextrade.example',
    id: 'OPS-DESK-01',
    color: 'text-cyan-400',
    borderColor: 'border-cyan-500/30',
    bgHover: 'hover:border-cyan-500/60 hover:bg-cyan-950/20',
    icon: Activity,
  },
];

export const AuthView: React.FC = () => {
  const { login, register, showToast, tenantBranding } = useApp();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('rohan.sen@nextrade.example');
  const [loginPassword, setLoginPassword] = useState('Password@123');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('trader_client');
  const [regOrg, setRegOrg] = useState('');
  const [regPan, setRegPan] = useState('');

  // Handle Login Submit
  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setErrorMessage('Please enter your Identifier (Email, Mobile, or User ID) and Password.');
      return;
    }

    setIsLoading(true);
    try {
      await login(loginIdentifier.trim(), loginPassword.trim());
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
      showToast(err.message || 'Login failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 1-Click Quick Demo Login
  const handleQuickLogin = async (card: QuickCard) => {
    setLoginIdentifier(card.email);
    setLoginPassword('Password@123');
    setErrorMessage(null);
    setIsLoading(true);
    try {
      await login(card.email, 'Password@123');
    } catch (err: any) {
      setErrorMessage(err.message || 'Quick login failed.');
      showToast(err.message || 'Login failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Signup Submit (No OTP)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      setErrorMessage('Full Name, Email Address, and Password are required.');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      await register({
        name: regName.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim() || undefined,
        password: regPassword.trim(),
        role: regRole,
        organization: regOrg.trim() || undefined,
        pan: regPan.trim() || undefined,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please check your inputs.');
      showToast(err.message || 'Registration failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(124,58,237,0.15),rgba(255,255,255,0))] text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans selection:bg-purple-500/30">
      {/* Top Header Branding */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between pb-6 border-b border-[#161f36]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-500/20 ring-1 ring-white/20">
            <Terminal className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white font-mono">
                {tenantBranding?.brandName || 'NexTrade'}
              </span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Broker OS
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              {tenantBranding?.tagline || 'Institutional Grade Broker Infrastructure'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#11192e] border border-[#1e2a47] text-[11px] text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">Live Integration:</span>
            <span className="text-slate-200 font-mono">Trading Platform (Render)</span>
          </div>
        </div>
      </header>

      {/* Main Authentication Card Container */}
      <main className="w-full max-w-xl mx-auto my-auto py-8">
        <div className="bg-[#0b101d]/90 backdrop-blur-xl border border-[#1e2b47] rounded-2xl shadow-2xl shadow-black/80 p-6 sm:p-8">
          {/* Tab Switcher */}
          <div className="flex items-center p-1 bg-[#10172b] rounded-xl border border-[#1a253e] mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setErrorMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'login'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-900/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Sign In to Terminal</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setErrorMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'register'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-900/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Create Account (Instant)</span>
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* TAB 1: LOGIN FORM */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Email, Client ID, or Mobile
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="e.g. rohan.sen@nextrade.example or BRK-ROHAN-01"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#10172a] border border-[#1d2945] rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Password</span>
                  <span className="text-[11px] text-purple-400 font-mono">Demo: Password@123</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter terminal password"
                    className="w-full pl-10 pr-11 py-2.5 bg-[#10172a] border border-[#1d2945] rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 transition-all shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Authorizing Session...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Terminal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Quick 1-Click Role Login Cards */}
              <div className="pt-6 border-t border-[#161f36]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    1-Click Demo Quick Logins
                  </span>
                  <span className="text-[10px] text-slate-500">Click to instantly launch</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {QUICK_CARDS.map((card) => {
                    const CardIcon = card.icon;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => handleQuickLogin(card)}
                        disabled={isLoading}
                        className={`text-left p-2.5 rounded-xl border bg-[#0e1424] transition-all cursor-pointer ${card.borderColor} ${card.bgHover} group disabled:opacity-50`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <CardIcon className={`w-3.5 h-3.5 ${card.color}`} />
                          <span className="text-[11px] font-semibold text-slate-200 truncate group-hover:text-white">
                            {card.title}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{card.subtitle}</div>
                        <div className="text-[9px] font-mono text-slate-500 truncate mt-0.5">{card.id}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: SIGNUP / CREATE ACCOUNT FORM (NO OTP) */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                <span>Instant Account Activation — Direct terminal access without any OTP verification.</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Legal Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Vikramaditya Singhania"
                    className="w-full pl-9 pr-3 py-2 bg-[#10172a] border border-[#1d2945] rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="trader@domain.com"
                      className="w-full pl-9 pr-3 py-2 bg-[#10172a] border border-[#1d2945] rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Mobile Number</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Phone className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-9 pr-3 py-2 bg-[#10172a] border border-[#1d2945] rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Account Role</label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-[#10172a] border border-[#1d2945] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition-colors"
                >
                  <option value="trader_client">Trader Client (DMA Terminal Access)</option>
                  <option value="broker_admin">Broker Admin (Full Broker Infrastructure)</option>
                  <option value="sub_broker">Sub-Broker / Partner (Franchisee Desk)</option>
                  <option value="master">Master Broker (Institutional Partner)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Organization (Optional)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Building className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      value={regOrg}
                      onChange={(e) => setRegOrg(e.target.value)}
                      placeholder="e.g. Apex Capital"
                      className="w-full pl-9 pr-3 py-2 bg-[#10172a] border border-[#1d2945] rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">PAN Card Number (Optional)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      value={regPan}
                      onChange={(e) => setRegPan(e.target.value.toUpperCase())}
                      placeholder="ABCDE1234F"
                      className="w-full pl-9 pr-3 py-2 bg-[#10172a] border border-[#1d2945] rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors uppercase font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="w-full pl-9 pr-10 py-2 bg-[#10172a] border border-[#1d2945] rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-3 py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 transition-all shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating Instant Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Instant Account</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Footer System Status & Security */}
      <footer className="w-full max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-[#161f36] text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <span>{tenantBranding?.footerCopyright || '© 2026 NexTrade Technologies Ltd.'}</span>
          <span className="hidden sm:inline">•</span>
          <span className="text-slate-400">Production Build v4.3.0</span>
        </div>

        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Lock className="w-3 h-3 text-emerald-400" />
            256-Bit SSL Encrypted
          </span>
          <span>•</span>
          <span className="text-slate-400">Strict Multi-Tenant Isolation</span>
        </div>
      </footer>
    </div>
  );
};
