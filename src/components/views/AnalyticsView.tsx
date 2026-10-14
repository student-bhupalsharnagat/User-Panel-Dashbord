/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  CheckCircle2,
  PieChart,
  Percent,
  Layers,
  ChevronDown,
  ArrowUpRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { AnalyticsData } from '../../types';

export const AnalyticsView: React.FC = () => {
  const { refreshTrigger, showToast, isLiveMode } = useApp();

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState<'7 Days' | '30 Days' | '90 Days'>('7 Days');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getAnalytics()
      .then((data) => setAnalytics(data))
      .catch((err) => console.error('Failed to load analytics:', err))
      .finally(() => setLoading(false));
  }, [refreshTrigger, timeRange]);

  const handleExportDashboard = () => {
    window.print();
    showToast('Exporting dashboard analysis snapshot...', 'info');
  };

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-white">Analytics</h2>
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
              isLiveMode
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
            }`}>
              {isLiveMode ? 'Live engine' : 'Demo data'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Understand growth, trading performance, and operational trends.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="bg-[#131b2e] border border-[#1e2a42] text-xs text-slate-300 rounded-lg px-3 py-1.5 sm:py-2 pr-8 appearance-none focus:outline-none cursor-pointer"
            >
              <option value="7 Days">7 Days</option>
              <option value="30 Days">30 Days</option>
              <option value="90 Days">90 Days</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            onClick={handleExportDashboard}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg bg-[#131b2e] border border-[#1e2a42] hover:bg-slate-800 text-xs font-medium text-slate-200 hover:text-white transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export dashboard</span>
          </button>
        </div>
      </div>

      {/* 4 Cards Grid (Page 10/11 Design) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#111827] border border-[#1e293b]">
          <div className="text-xs font-semibold text-slate-400 mb-2">Monthly turnover</div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">
            ₹{analytics?.monthlyTurnoverCr || '742.8'} Cr
          </div>
          <div className="text-[11px] text-emerald-400 font-medium mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+{analytics?.turnoverChangePct || 12.6}% vs last month</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-[#1e293b]">
          <div className="text-xs font-semibold text-slate-400 mb-2">Commission earned</div>
          <div className="text-2xl font-bold font-mono text-indigo-300 tracking-tight">
            ₹{analytics?.commissionEarnedL || '28.42'} L
          </div>
          <div className="text-[11px] text-emerald-400 font-medium mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+{analytics?.commissionChangePct || 5.4}% vs last month</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-[#1e293b]">
          <div className="text-xs font-semibold text-slate-400 mb-2">Order execution</div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">
            {analytics?.orderExecutionRate || '94.8'}%
          </div>
          <div className="text-[11px] text-emerald-400 font-medium mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+{analytics?.executionImprovementPct || 1.1}% improvement</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-[#1e293b]">
          <div className="text-xs font-semibold text-slate-400 mb-2">Net P&L</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
            +₹{analytics?.netPnLL || '42.16'} L
          </div>
          <div className="text-[11px] text-emerald-400 font-medium mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+{analytics?.netPnLChangePct || 8.8}% this month</span>
          </div>
        </div>
      </div>

      {/* Row 2: Trading Turnover Area Wave Chart + Commission Earnings Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trading Turnover Area Chart */}
        <div className="p-5 rounded-xl bg-[#111827] border border-[#1e293b]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Trading turnover</h3>
              <p className="text-[11px] text-slate-400">Daily volume in crores</p>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-400">Peak: ₹172.5 Cr</span>
          </div>

          <div className="h-56 w-full relative pt-2">
            <svg viewBox="0 0 600 200" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="analyticsTurnover" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {[40, 90, 140, 190].map((y) => (
                <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="#1e293b" strokeDasharray="4 4" strokeWidth="1" />
              ))}

              <path
                d="M 20 150 Q 110 120 200 160 T 380 90 T 500 70 T 580 110 L 580 195 L 20 195 Z"
                fill="url(#analyticsTurnover)"
              />
              <path
                d="M 20 150 Q 110 120 200 160 T 380 90 T 500 70 T 580 110"
                fill="none"
                stroke="#6366f1"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {[
                { cx: 20, cy: 150, val: '88.5 Cr' },
                { cx: 110, cy: 122, val: '112.4 Cr' },
                { cx: 205, cy: 158, val: '96.2 Cr' },
                { cx: 295, cy: 108, val: '145.0 Cr' },
                { cx: 390, cy: 126, val: '118.8 Cr' },
                { cx: 485, cy: 72, val: '172.5 Cr' },
                { cx: 580, cy: 110, val: '128.4 Cr' },
              ].map((pt, i) => (
                <circle
                  key={i}
                  cx={pt.cx}
                  cy={pt.cy}
                  r="4"
                  fill="#111827"
                  stroke="#818cf8"
                  strokeWidth="2"
                  className="hover:r-6 cursor-pointer transition-all"
                />
              ))}
            </svg>

            <div className="flex justify-between text-[11px] text-slate-500 pt-2 font-mono">
              <span>16 Apr</span>
              <span>17 Apr</span>
              <span>18 Apr</span>
              <span>19 Apr</span>
              <span>20 Apr</span>
              <span>21 Apr</span>
              <span>22 Apr</span>
            </div>
          </div>
        </div>

        {/* Commission Earnings Bar Chart */}
        <div className="p-5 rounded-xl bg-[#111827] border border-[#1e293b]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Commission earnings</h3>
              <p className="text-[11px] text-slate-400">Daily net earnings in lakhs</p>
            </div>
            <span className="text-xs font-mono font-bold text-purple-400">Total: ₹33.2 L</span>
          </div>

          <div className="h-56 w-full flex items-end justify-between gap-3 pt-6 px-3">
            {[
              { day: '16 Apr', h: 50, val: '₹3.2 L' },
              { day: '17 Apr', h: 75, val: '₹4.8 L' },
              { day: '18 Apr', h: 60, val: '₹3.9 L' },
              { day: '19 Apr', h: 88, val: '₹5.6 L' },
              { day: '20 Apr', h: 65, val: '₹4.2 L' },
              { day: '21 Apr', h: 100, val: '₹6.4 L' },
              { day: '22 Apr', h: 80, val: '₹5.1 L' },
            ].map((bar, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <div
                  style={{ height: `${bar.h}%` }}
                  className="w-full max-w-[28px] bg-purple-600 rounded-t-sm group-hover:bg-purple-500 transition-all relative"
                  title={bar.val}
                />
                <span className="text-[10px] text-slate-500 font-mono">{bar.day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Active vs Inactive Donut + Order Execution Bars + Instrument Activity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active vs Inactive Donut */}
        <div className="p-5 rounded-xl bg-[#111827] border border-[#1e293b]">
          <h3 className="text-sm font-bold text-white mb-1">Active vs inactive</h3>
          <p className="text-[11px] text-slate-400 mb-4">Current client split</p>

          <div className="flex items-center justify-center gap-6 my-4">
            <div className="relative w-32 h-32">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="38" fill="none" stroke="#1e293b" strokeWidth="12" />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="12"
                  strokeDasharray="238.76"
                  strokeDashoffset={238.76 * (1 - 0.86)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold font-mono text-white">86%</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400">Active</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                <span className="text-slate-400">Active:</span>
                <span className="font-mono font-bold text-white ml-auto">2,142</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
                <span className="text-slate-400">Inactive:</span>
                <span className="font-mono font-bold text-slate-300 ml-auto">344</span>
              </div>
            </div>
          </div>
        </div>

        {/* Order Execution Status Bars */}
        <div className="p-5 rounded-xl bg-[#111827] border border-[#1e293b] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Order execution</h3>
            <p className="text-[11px] text-slate-400 mb-4">By final status</p>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span className="font-sans">Executed</span>
                  <span className="text-emerald-400 font-bold">76%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '76%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span className="font-sans">Open</span>
                  <span className="text-blue-400 font-bold">12%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: '12%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span className="font-sans">Rejected</span>
                  <span className="text-rose-400 font-bold">7%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: '7%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span className="font-sans">Cancelled</span>
                  <span className="text-slate-400 font-bold">5%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-slate-600 rounded-full" style={{ width: '5%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Instrument Activity Share */}
        <div className="p-5 rounded-xl bg-[#111827] border border-[#1e293b] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Instrument activity</h3>
            <p className="text-[11px] text-slate-400 mb-4">Share of turnover</p>

            <div className="space-y-2.5 text-xs font-mono">
              {[
                { symbol: 'NIFTY', pct: 32, color: 'bg-indigo-500' },
                { symbol: 'BANKNIFTY', pct: 26, color: 'bg-purple-500' },
                { symbol: 'RELIANCE', pct: 14, color: 'bg-cyan-500' },
                { symbol: 'TCS', pct: 9, color: 'bg-teal-500' },
                { symbol: 'OTHERS', pct: 19, color: 'bg-slate-600' },
              ].map((item) => (
                <div key={item.symbol} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${item.color} shrink-0`} />
                    <span className="text-slate-300 font-bold">{item.symbol}</span>
                  </div>
                  <span className="text-white font-bold">{item.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400">
            Total active contracts: <span className="text-white font-mono font-bold">142</span>
          </div>
        </div>
      </div>
    </div>
  );
};
