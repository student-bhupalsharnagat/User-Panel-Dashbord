/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Info, X, ShieldAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const BannerNotice: React.FC = () => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [showLearnMore, setShowLearnMore] = useState(false);
  const { isLiveMode } = useApp();

  if (isDismissed) return null;

  return (
    <>
      <div className="bg-[#0e1627] border-b border-[#1c2840] px-3 sm:px-6 py-1.5 sm:py-2 flex items-center justify-between text-[11px] sm:text-xs text-slate-300 gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 truncate min-w-0">
          <span className="font-semibold text-slate-200 shrink-0">Demo workspace</span>
          <span className="text-slate-500 hidden xs:inline">·</span>
          <span className="text-slate-400 truncate hidden xs:inline">
            {isLiveMode 
              ? 'Connected to authoritative Trading Engine with live market feeds and order reconciliation.' 
              : 'All identities, prices, balances, and transactions shown are operational sandbox records.'}
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <button
            onClick={() => setShowLearnMore(true)}
            className="text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer whitespace-nowrap"
          >
            Learn more
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
            aria-label="Dismiss banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Learn More Modal */}
      {showLearnMore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#131b2e] border border-[#1e2a42] rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Three-Application Ecosystem Architecture</h3>
                  <p className="text-xs text-slate-400">NexTrade Integration Blueprint</p>
                </div>
              </div>
              <button
                onClick={() => setShowLearnMore(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="font-semibold text-indigo-300 mb-1">1. Trading Platform</div>
                <p className="text-slate-400">
                  Authoritative execution engine, order gateway, real-time positions, margin calculations, and client ledger sources.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="font-semibold text-purple-300 mb-1">2. Central Admin Panel</div>
                <p className="text-slate-400">
                  Multi-tenant governance, broker commission rules, white-label branding, global trading halts, and compliance.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="font-semibold text-emerald-300 mb-1">3. NexTrade User/Broker Panel</div>
                <p className="text-slate-400">
                  The active interface: authenticated dashboard, market watch, client management, live orders, position square-offs, fund approvals, and analytics.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowLearnMore(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
