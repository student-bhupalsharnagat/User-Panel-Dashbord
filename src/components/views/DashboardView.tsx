/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  BookOpen,
  TrendingUp,
  Download,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
  DollarSign,
  Activity,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import {
  AccountActivityBar,
  MetricSummary,
  OperationsQueueItem,
  TurnoverTrendPoint,
} from '../../types';

export const DashboardView: React.FC = () => {
  const {
    setActiveTab,
    refreshTrigger,
    isLiveMode,
    showToast,
    openOrderModal,
  } = useApp();

  const [timeRange, setTimeRange] = useState<'Today' | '7 Days' | '30 Days' | 'This Month'>('Today');
  const [metrics, setMetrics] = useState<MetricSummary | null>(null);
  const [turnoverTrend, setTurnoverTrend] = useState<TurnoverTrendPoint[]>([]);
  const [accountActivity, setAccountActivity] = useState<AccountActivityBar[]>([]);
  const [operationsQueue, setOperationsQueue] = useState<OperationsQueueItem[]>([]);
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);

  const trendPoints = React.useMemo(() => {
    const baseCr = metrics?.clientTurnoverCr || 248.6;
    if (timeRange === 'Today') {
      const times = ['09:15', '10:30', '11:45', '13:00', '14:15', '15:30'];
      const factors = [0.15, 0.35, 0.55, 0.72, 0.88, 1.0];
      return times.map((t, idx) => {
        const valCr = +(baseCr * factors[idx]).toFixed(1);
        const y = 180 - Math.min(140, Math.round(factors[idx] * 130));
        const x = 30 + idx * (640 / (times.length - 1));
        return { label: t, val: `₹${valCr} Cr`, cx: x, cy: y };
      });
    } else if (timeRange === '7 Days') {
      const days = ['Day -6', 'Day -5', 'Day -4', 'Day -3', 'Day -2', 'Yesterday', 'Today'];
      const multipliers = [0.72, 0.85, 0.79, 1.1, 0.92, 1.24, 1.0];
      return days.map((d, idx) => {
        const valCr = +(baseCr * multipliers[idx]).toFixed(1);
        const y = 180 - Math.min(140, Math.round((multipliers[idx] / 1.3) * 120));
        const x = 30 + idx * (640 / (days.length - 1));
        return { label: d, val: `₹${valCr} Cr`, cx: x, cy: y };
      });
    } else if (timeRange === '30 Days') {
      const intervals = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'MTD'];
      const multipliers = [3.8, 4.2, 3.9, 4.6, 5.1];
      return intervals.map((intv, idx) => {
        const valCr = +(multipliers[idx]).toFixed(1);
        const y = 180 - Math.min(140, Math.round(((idx + 1) / 5) * 120));
        const x = 30 + idx * (640 / (intervals.length - 1));
        return { label: intv, val: `₹${valCr} Cr`, cx: x, cy: y };
      });
    } else {
      const weeks = ['1-7th', '8-14th', '15-21st', '22-28th', 'Current'];
      const multipliers = [0.65, 0.85, 1.05, 0.95, 1.15];
      return weeks.map((w, idx) => {
        const valCr = +(baseCr * multipliers[idx]).toFixed(1);
        const y = 180 - Math.min(140, Math.round((multipliers[idx] / 1.3) * 120));
        const x = 30 + idx * (640 / (weeks.length - 1));
        return { label: w, val: `₹${valCr} Cr`, cx: x, cy: y };
      });
    }
  }, [timeRange, metrics?.clientTurnoverCr]);

  const svgPathD = React.useMemo(() => {
    if (trendPoints.length === 0) return '';
    return trendPoints.reduce((acc, pt, i) => (i === 0 ? `M ${pt.cx} ${pt.cy}` : `${acc} L ${pt.cx} ${pt.cy}`), '');
  }, [trendPoints]);

  const svgAreaD = React.useMemo(() => {
    if (trendPoints.length === 0) return '';
    const first = trendPoints[0];
    const last = trendPoints[trendPoints.length - 1];
    return `${svgPathD} L ${last.cx} 195 L ${first.cx} 195 Z`;
  }, [svgPathD, trendPoints]);

  const activityBars = React.useMemo(() => {
    const baseDep = +(metrics?.marginUsedCr ? metrics.marginUsedCr * 0.6 : 4.8).toFixed(1);
    const baseWdr = +(metrics?.marginUsedCr ? metrics.marginUsedCr * 0.28 : 2.1).toFixed(1);
    if (timeRange === 'Today') {
      return [
        { day: '09-11', dep: 60, wdr: 25, depVal: `₹${(baseDep * 0.3).toFixed(1)} Cr`, wdrVal: `₹${(baseWdr * 0.2).toFixed(1)} Cr` },
        { day: '11-13', dep: 90, wdr: 45, depVal: `₹${(baseDep * 0.5).toFixed(1)} Cr`, wdrVal: `₹${(baseWdr * 0.5).toFixed(1)} Cr` },
        { day: '13-15', dep: 45, wdr: 30, depVal: `₹${(baseDep * 0.2).toFixed(1)} Cr`, wdrVal: `₹${(baseWdr * 0.3).toFixed(1)} Cr` },
      ];
    } else if (timeRange === '7 Days') {
      return [
        { day: 'Mon', dep: 68, wdr: 36, depVal: '₹3.4 Cr', wdrVal: '₹1.8 Cr' },
        { day: 'Tue', dep: 82, wdr: 42, depVal: '₹4.1 Cr', wdrVal: '₹2.1 Cr' },
        { day: 'Wed', dep: 58, wdr: 30, depVal: '₹2.9 Cr', wdrVal: '₹1.5 Cr' },
        { day: 'Thu', dep: 104, wdr: 48, depVal: '₹5.2 Cr', wdrVal: '₹2.4 Cr' },
        { day: 'Fri', dep: 96, wdr: 43, depVal: `₹${baseDep} Cr`, wdrVal: `₹${baseWdr} Cr` },
      ];
    } else {
      return [
        { day: 'Wk 1', dep: 70, wdr: 35, depVal: `₹${(baseDep * 1.8).toFixed(1)} Cr`, wdrVal: `₹${(baseWdr * 1.5).toFixed(1)} Cr` },
        { day: 'Wk 2', dep: 85, wdr: 40, depVal: `₹${(baseDep * 2.2).toFixed(1)} Cr`, wdrVal: `₹${(baseWdr * 1.8).toFixed(1)} Cr` },
        { day: 'Wk 3', dep: 65, wdr: 30, depVal: `₹${(baseDep * 1.9).toFixed(1)} Cr`, wdrVal: `₹${(baseWdr * 1.4).toFixed(1)} Cr` },
        { day: 'Wk 4', dep: 95, wdr: 45, depVal: `₹${(baseDep * 2.5).toFixed(1)} Cr`, wdrVal: `₹${(baseWdr * 2.0).toFixed(1)} Cr` },
      ];
    }
  }, [timeRange, metrics?.marginUsedCr]);

  useEffect(() => {
    api.getDashboardSummary()
      .then((res) => {
        setMetrics(res.metrics);
        setTurnoverTrend(res.turnoverTrend);
        setAccountActivity(res.accountActivity);
        setOperationsQueue(res.operationsQueue);
      })
      .catch((err) => {
        console.error('Failed to load dashboard data:', err);
      });
  }, [refreshTrigger]);

  // Single source for every client count on this page so cards, ribbon and donut always agree
  const totalClients = metrics?.totalClients ?? 0;
  const activeClients = metrics?.activeClients ?? 0;
  const inactiveClients = metrics?.inactiveClients ?? Math.max(0, totalClients - activeClients);
  const newToday = metrics?.newToday ?? 0;
  const activeRatioPct = totalClients > 0 ? +((activeClients / totalClients) * 100).toFixed(1) : 0;

  const handleExportSummary = () => {
    if (!metrics) return;
    const summaryData = [
      ['Metric', 'Value'],
      ['Total Clients', metrics.totalClients],
      ['Active Clients', metrics.activeClients],
      ['Inactive Clients', metrics.inactiveClients],
      ['New Today', metrics.newToday],
      ['Ledger Balance (Cr)', `₹${metrics.ledgerBalanceCr} Cr`],
      ['Open P&L (L)', `+₹${metrics.openPnLL} L`],
      ['Margin Used (Cr)', `₹${metrics.marginUsedCr} Cr`],
      ['Margin Available (Cr)', `₹${metrics.marginAvailableCr} Cr`],
      ['Today Orders', metrics.todaysOrders],
      ['Client Turnover (Cr)', `₹${metrics.clientTurnoverCr} Cr`],
      ['Commission (L)', `₹${metrics.commissionL} L`],
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + summaryData.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NextTrade_Summary_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported Executive Summary to CSV', 'success');
  };

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto text-slate-100">
      {/* Subheader Title & Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-white">Business overview</h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              {isLiveMode ? 'Live engine' : 'Sandbox mode'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor client activity, balances, and trading performance.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Time range selector */}
          <div className="relative">
            <select
              value={timeRange}
              onChange={(e) => {
                setTimeRange(e.target.value as any);
                showToast(`Filter applied: ${e.target.value}`, 'info');
              }}
              className="bg-[#131b2e] border border-[#1e2a42] hover:border-slate-700 text-xs font-medium text-slate-200 rounded-lg px-3 py-2 pr-8 appearance-none focus:outline-none cursor-pointer"
            >
              <option value="Today">Today</option>
              <option value="7 Days">7 Days</option>
              <option value="30 Days">30 Days</option>
              <option value="This Month">This Month</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Export summary */}
          <button
            onClick={handleExportSummary}
            className="px-3.5 py-2 rounded-lg bg-[#131b2e] border border-[#1e2a42] hover:bg-slate-800 text-xs font-medium text-slate-200 hover:text-white transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export summary</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Cards Grid (4 Cards from Page 1 Design) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Clients */}
        <div className="p-4 rounded-xl bg-[#111827] border border-[#1e293b] relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">Total clients</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">
            {metrics ? metrics.totalClients.toLocaleString('en-IN') : '0'}
          </div>
          <div className="text-[11px] text-emerald-400 font-medium mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+{metrics?.totalClientsChangePct || 12.1}% this month</span>
          </div>
        </div>

        {/* Card 2: Active Clients */}
        <div className="p-4 rounded-xl bg-[#111827] border border-[#1e293b] relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">Active clients</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">
            {metrics ? metrics.activeClients.toLocaleString('en-IN') : '0'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {activeRatioPct}% on book
          </div>
        </div>

        {/* Card 3: Ledger Balance */}
        <div className="p-4 rounded-xl bg-[#111827] border border-[#1e293b] relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">Ledger balance</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">
            ₹{metrics?.ledgerBalanceCr || 18.42} Cr
          </div>
          <div className="text-[11px] text-emerald-400 font-medium mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+₹{metrics?.ledgerBalanceNetWeekL || 84.1} L net week</span>
          </div>
        </div>

        {/* Card 4: Open P&L */}
        <div className="p-4 rounded-xl bg-[#111827] border border-[#1e293b] relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">Open P&L</span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-bold font-mono tracking-tight ${(metrics?.openPnLL ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {(metrics?.openPnLL ?? 0) >= 0 ? '+' : ''}₹{Number(metrics?.openPnLL ?? 0).toFixed(2)} L
          </div>
          <div className={`text-[11px] font-medium mt-1 flex items-center gap-1 ${(metrics?.openPnLDayChangePct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{(metrics?.openPnLDayChangePct ?? 0) >= 0 ? '+' : ''}{metrics?.openPnLDayChangePct ?? 0}% on day</span>
          </div>
        </div>
      </div>

      {/* Sub-Metrics Dense Ribbon (Responsive for all screen sizes) */}
      <div className="p-2 sm:p-3 rounded-xl bg-[#111827] border border-[#1e293b] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2 text-center">
        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/40">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">Inactive</div>
          <div className="text-xs font-bold font-mono text-slate-200 mt-0.5">{inactiveClients}</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/40">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">New today</div>
          <div className="text-xs font-bold font-mono text-slate-200 mt-0.5">{newToday}</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/40">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">Margin used</div>
          <div className="text-xs font-bold font-mono text-slate-200 mt-0.5">₹{metrics?.marginUsedCr || 7.28} Cr</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/40">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">Avail margin</div>
          <div className="text-xs font-bold font-mono text-slate-200 mt-0.5">₹{metrics?.marginAvailableCr || 11.14} Cr</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/40">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">Today's orders</div>
          <div className="text-xs font-bold font-mono text-slate-200 mt-0.5">{metrics?.todaysOrders ? metrics.todaysOrders.toLocaleString('en-IN') : '8,492'}</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/40">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">Pending dep</div>
          <div className="text-xs font-bold font-mono text-amber-400 mt-0.5">{metrics?.pendingDeposits || 18}</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/40">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">Pending wdr</div>
          <div className="text-xs font-bold font-mono text-rose-400 mt-0.5">{metrics?.pendingWithdrawals || 9}</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/40">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">Turnover</div>
          <div className="text-xs font-bold font-mono text-slate-200 mt-0.5">₹{metrics?.clientTurnoverCr || 248.6} Cr</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/40 col-span-2 sm:col-span-1">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">Commission</div>
          <div className="text-xs font-bold font-mono text-indigo-300 mt-0.5">₹{metrics?.commissionL || 9.42} L</div>
        </div>
      </div>

      {/* Row 2: Turnover Trend Chart (Left 60%) + Account Activity (Right 40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Turnover Trend Area Wave Chart */}
        <div className="lg:col-span-7 p-5 rounded-xl bg-[#111827] border border-[#1e293b]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Turnover trend</h3>
              <p className="text-[11px] text-slate-400">Daily traded volume across all client accounts</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span>₹{metrics?.clientTurnoverCr || 248.6} Cr ({timeRange})</span>
            </div>
          </div>

          {/* SVG Smooth Area Wave Chart */}
          <div className="h-56 w-full relative pt-2">
            <svg viewBox="0 0 700 200" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="turnoverGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[40, 90, 140, 190].map((y) => (
                <line
                  key={y}
                  x1="0"
                  y1={y}
                  x2="700"
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              ))}

              {/* Area path */}
              <path
                d={svgAreaD}
                fill="url(#turnoverGrad)"
              />

              {/* Stroke line */}
              <path
                d={svgPathD}
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Data points */}
              {trendPoints.map((pt, i) => (
                <g key={i}>
                  <circle
                    cx={pt.cx}
                    cy={pt.cy}
                    r="4"
                    fill="#111827"
                    stroke="#a78bfa"
                    strokeWidth="2"
                    className="cursor-pointer hover:r-6 transition-all"
                    onMouseEnter={() => setHoveredTrendIndex(i)}
                    onMouseLeave={() => setHoveredTrendIndex(null)}
                  />
                  {hoveredTrendIndex === i && (
                    <g>
                      <rect
                        x={pt.cx - 45}
                        y={pt.cy - 35}
                        width="90"
                        height="26"
                        rx="4"
                        fill="#0c1220"
                        stroke="#6366f1"
                        strokeWidth="1"
                      />
                      <text
                        x={pt.cx}
                        y={pt.cy - 18}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="10"
                        fontFamily="JetBrains Mono"
                        fontWeight="bold"
                      >
                        {pt.val}
                      </text>
                    </g>
                  )}
                </g>
              ))}
            </svg>

            {/* Bottom X-Axis labels */}
            <div className="flex justify-between text-[11px] text-slate-500 pt-2 font-mono">
              {trendPoints.map((pt, i) => (
                <span key={i}>{pt.label}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Account Activity Bar Chart */}
        <div className="lg:col-span-5 p-5 rounded-xl bg-[#111827] border border-[#1e293b] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-white">Account activity</h3>
              <button
                onClick={() => setActiveTab('account_ledger')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>View ledger</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono mb-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
                <span className="text-slate-400">Deposits:</span>
                <span className="text-white font-semibold">₹4.82 Cr</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-purple-500/50" />
                <span className="text-slate-400">Withdrawals:</span>
                <span className="text-white font-semibold">₹2.16 Cr</span>
              </div>
            </div>

            {/* Dual Bar Columns */}
            <div className="h-44 w-full flex items-end justify-between gap-3 pt-4 px-2">
              {activityBars.map((bar, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <div className="w-full flex items-end justify-center gap-1 h-32">
                    <div
                      style={{ height: `${bar.dep}%` }}
                      className="w-3.5 bg-indigo-500 rounded-t-sm group-hover:bg-indigo-400 transition-all relative"
                      title={`Deposits: ${bar.depVal}`}
                    />
                    <div
                      style={{ height: `${bar.wdr}%` }}
                      className="w-3.5 bg-purple-500/40 rounded-t-sm group-hover:bg-purple-500/60 transition-all relative"
                      title={`Withdrawals: ${bar.wdrVal}`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">{bar.day}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>Net cash inflow (Weekly):</span>
            <span className="font-mono text-emerald-400 font-semibold">+₹2.66 Cr</span>
          </div>
        </div>
      </div>

      {/* Row 3: Client Growth Donut + Operations Queue + P&L Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Client Growth Donut */}
        <div className="p-5 rounded-xl bg-[#111827] border border-[#1e293b]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">Client growth</h3>
            <span className="text-[11px] text-slate-400">Last 30 days</span>
          </div>

          <div className="flex items-center justify-center gap-6 my-2">
            {/* SVG Donut */}
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
                  strokeDashoffset={238.76 * (1 - activeRatioPct / 100)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold font-mono text-white">{Math.round(activeRatioPct)}%</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400">Active</span>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                <span className="text-slate-400">Active</span>
                <span className="font-mono font-semibold text-white ml-auto">{activeClients.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
                <span className="text-slate-400">Inactive</span>
                <span className="font-mono font-semibold text-slate-300 ml-auto">{inactiveClients.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                <span className="text-slate-400">New</span>
                <span className="font-mono font-semibold text-slate-300 ml-auto">{newToday.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Operations Queue */}
        <div className="p-5 rounded-xl bg-[#111827] border border-[#1e293b]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">Operations queue</h3>
            <span className="text-[11px] text-slate-400">Items requiring review</span>
          </div>

          <div className="space-y-2.5">
            {operationsQueue.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.statusType === 'deposit' || item.statusType === 'withdrawal') {
                    setActiveTab('funds');
                  } else if (item.statusType === 'kyc') {
                    setActiveTab('clients');
                  } else {
                    setActiveTab('orders');
                  }
                }}
                className="w-full p-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 flex items-center justify-between transition-colors text-xs text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-300 group-hover:text-white transition-colors">{item.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-white px-2 py-0.5 rounded bg-slate-800 text-xs">
                    {item.count}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-600 -rotate-90 group-hover:text-slate-400" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* P&L Summary */}
        <div className="p-5 rounded-xl bg-[#111827] border border-[#1e293b] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">P&L summary</h3>
              <span className="text-[11px] text-slate-400">Today across all positions</span>
            </div>

            <div className={`text-3xl font-extrabold font-mono tracking-tight my-2 ${(metrics?.realisedPnL ?? 0) + (metrics?.unrealisedPnL ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {metrics?.totalPnLFormatted || '+₹0'}
            </div>

            <div className="space-y-3 mt-4 text-xs font-mono">
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span className="font-sans">Realised:</span>
                  <span className={`font-bold ${(metrics?.realisedPnL ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {metrics?.realisedPnL !== undefined
                      ? `${metrics.realisedPnL >= 0 ? '+' : '-'}₹${Math.abs(metrics.realisedPnL).toLocaleString('en-IN')}`
                      : '₹0'}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{
                      width: `${
                        Math.abs(metrics?.realisedPnL || 0) + Math.abs(metrics?.unrealisedPnL || 0) > 0
                          ? Math.round((Math.abs(metrics?.realisedPnL || 0) / (Math.abs(metrics?.realisedPnL || 0) + Math.abs(metrics?.unrealisedPnL || 0))) * 100)
                          : 50
                      }%`
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span className="font-sans">Unrealised:</span>
                  <span className={`font-bold ${(metrics?.unrealisedPnL ?? 0) >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                    {metrics?.unrealisedPnL !== undefined
                      ? `${metrics.unrealisedPnL >= 0 ? '+' : '-'}₹${Math.abs(metrics.unrealisedPnL).toLocaleString('en-IN')}`
                      : '₹0'}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-teal-400 rounded-full"
                    style={{
                      width: `${
                        Math.abs(metrics?.realisedPnL || 0) + Math.abs(metrics?.unrealisedPnL || 0) > 0
                          ? Math.round((Math.abs(metrics?.unrealisedPnL || 0) / (Math.abs(metrics?.realisedPnL || 0) + Math.abs(metrics?.unrealisedPnL || 0))) * 100)
                          : 50
                      }%`
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Total portfolio exposure:</span>
            <button
              onClick={() => setActiveTab('positions')}
              className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
            >
              Inspect Positions →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
