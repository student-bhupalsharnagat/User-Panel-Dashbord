/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, UserPlus, Shield, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

export const AddClientModal: React.FC = () => {
  const { isAddClientOpen, setIsAddClientOpen, showToast, triggerRefresh } = useApp();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pan, setPan] = useState('');
  const [initialMargin, setInitialMargin] = useState<number | string>(0);
  const [isDemo, setIsDemo] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isAddClientOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !email.trim() || !phone.trim()) {
      setErrorMessage('Full name, email address, and mobile number are required.');
      return;
    }

    const digitsOnly = phone.replace(/\D/g, '');
    const validDigits = digitsOnly.length === 12 && digitsOnly.startsWith('91')
      ? digitsOnly.slice(2)
      : (digitsOnly.length === 11 && digitsOnly.startsWith('0') ? digitsOnly.slice(1) : digitsOnly);

    if (validDigits.length !== 10 || !/^[6-9]/.test(validDigits)) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number starting with 6-9. (Numeric length must be 10 digits).');
      return;
    }

    const panClean = (pan || '').trim().toUpperCase();
    if (!panClean || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panClean)) {
      setErrorMessage('Invalid PAN format. Standard PAN must be 5 letters, 4 numbers, and 1 letter (e.g. ABCDE1234F). Numeric-only values (like 1234567890) are strictly rejected.');
      return;
    }

    const parsedMargin = (initialMargin === '' || initialMargin === null || isNaN(Number(initialMargin)))
      ? 0
      : Math.max(0, Number(initialMargin));

    setIsSubmitting(true);
    try {
      const newClient = await api.createClient({
        name: name.trim(),
        email: email.trim(),
        phone: `+91 ${validDigits}`,
        pan: panClean,
        initialMargin: parsedMargin,
        ledgerBalance: parsedMargin,
        isDemo,
      });

      showToast(`Client ${newClient.name} (${newClient.id}) created and assigned!`, 'success');
      triggerRefresh();
      setIsAddClientOpen(false);
      setName('');
      setEmail('');
      setPhone('');
      setPan('');
      setInitialMargin(0);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to onboard client');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#111827] border border-[#1e293b] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden text-slate-200 max-h-[92vh] flex flex-col">
        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Add New Client Account</h3>
              <p className="text-[11px] text-slate-400">Onboarding & broker assignment</p>
            </div>
          </div>
          <button
            onClick={() => setIsAddClientOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in duration-100">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Full Legal Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Diya Kapoor"
              className="w-full bg-[#131b2e] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="diya@example.com"
                className="w-full bg-[#131b2e] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Mobile Number *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98204 81315"
                className="w-full bg-[#131b2e] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                PAN Number
              </label>
              <input
                type="text"
                value={pan}
                onChange={(e) => setPan(e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
                maxLength={10}
                className="w-full bg-[#131b2e] border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono uppercase text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Initial Margin (INR)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={initialMargin}
                onChange={(e) => setInitialMargin(e.target.value)}
                className="w-full bg-[#131b2e] border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Account Mode Checkbox */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-white">Create as Demo Sandbox Account</div>
              <div className="text-[11px] text-slate-400">Generates DM-prefixed account for simulated orders</div>
            </div>
            <input
              type="checkbox"
              checked={isDemo}
              onChange={(e) => setIsDemo(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-800"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddClientOpen(false)}
              className="flex-1 py-2 text-xs font-semibold text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-md disabled:opacity-50"
            >
              {isSubmitting ? 'Onboarding...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
