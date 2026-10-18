/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Search,
  Download,
  FileText,
  BookOpen,
  DollarSign,
  TrendingUp,
  Percent,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { LedgerEntry } from '../../types';

export const LedgerView: React.FC = () => {
  const { refreshTrigger, showToast, isLiveMode } = useApp();

  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState('Today');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getLedger()
      .then((data) => {
        setLedgerEntries(data.entries);
        setSummary(data.summary);
      })
      .catch((err) => console.error('Failed to load ledger:', err))
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  const filteredEntries = ledgerEntries.filter((e) => {
    const q = searchQuery.toLowerCase();
    return (
      e.id.toLowerCase().includes(q) ||
      e.referenceId.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q)
    );
  });

  const paginatedEntries = filteredEntries.slice((page - 1) * pageSize, page * pageSize);

  const handleExportCSV = () => {
    if (ledgerEntries.length === 0) return;
    const headers = ['Transaction Date', 'Reference ID', 'Description', 'Type', 'Debit (INR)', 'Credit (INR)', 'Running Balance (INR)', 'Status'];
    const rows = ledgerEntries.map(e => [
      e.date,
      e.referenceId,
      `"${e.description}"`,
      e.type,
      e.debit,
      e.credit,
      e.runningBalance,
      e.status,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NextTrade_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported Ledger Journal to CSV', 'success');
  };

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-white">Account</h2>
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
              isLiveMode
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
            }`}>
              {isLiveMode ? 'Live engine' : 'Sandbox mode'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            View broker balances, ledger entries, and authoritative account status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg bg-[#131b2e] border border-[#1e2a42] hover:bg-slate-800 text-xs font-medium text-slate-200 hover:text-white transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg bg-[#131b2e] border border-[#1e2a42] hover:bg-slate-800 text-xs font-medium text-slate-200 hover:text-white transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* 4 Cards Row (Page 9 Design) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#111827] border border-[#1e293b]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Ledger balance</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">
            ₹{summary?.ledgerBalanceCr || '1.84'} Cr
          </div>
          <div className="text-[11px] text-rose-400 font-medium mt-1 flex items-center gap-1">
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>-₹84,392 today</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-[#1e293b]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Available margin</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">
            ₹{summary?.availableMarginCr || '1.12'} Cr
          </div>
          <div className="text-[11px] text-emerald-400 font-medium mt-1">60.9% available</div>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-[#1e293b]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Used margin</span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">
            ₹{summary?.usedMarginL || '72.18'} L
          </div>
          <div className="text-[11px] text-slate-400 mt-1">39.2% allocated</div>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-[#1e293b]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Commission</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-300 tracking-tight">
            ₹{summary?.commissionL || '9.42'} L
          </div>
          <div className="text-[11px] text-emerald-400 font-medium mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+8.4% this month</span>
          </div>
        </div>
      </div>

      {/* Account Ledger Card */}
      <div className="p-5 rounded-xl bg-[#111827] border border-[#1e293b] space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white">Account ledger</h3>
            <p className="text-[11px] text-slate-400">
              {ledgerEntries.length} authoritative ledger reconciliation entries
            </p>
          </div>
        </div>

        {/* Search & Filters Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search account ledger (reference, description)..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#131b2e] border border-[#1e2a42] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="bg-[#131b2e] border border-[#1e2a42] text-xs text-slate-300 rounded-lg px-2.5 py-1.5 pr-7 appearance-none focus:outline-none cursor-pointer"
              >
                <option value="Today">Today</option>
                <option value="Yesterday">Yesterday</option>
                <option value="This Month">This Month</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[800px] text-xs text-left">
            <thead className="bg-[#141d30] text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Transaction Date</th>
                <th className="px-4 py-3">Reference ID</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Debit</th>
                <th className="px-4 py-3 text-right">Credit</th>
                <th className="px-4 py-3 text-right">Running Balance</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/60 font-mono">
              {paginatedEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-800/60 transition-colors">
                  <td className="px-4 py-3 font-sans text-slate-400 text-xs">
                    {entry.date}
                  </td>

                  <td className="px-4 py-3 font-bold text-indigo-300 text-xs">
                    {entry.referenceId}
                  </td>

                  <td className="px-4 py-3 font-sans text-slate-200 font-medium">
                    {entry.description}
                  </td>

                  <td className="px-4 py-3 text-right text-rose-400">
                    {entry.debit > 0 ? `₹${entry.debit.toLocaleString('en-IN')}` : '—'}
                  </td>

                  <td className="px-4 py-3 text-right text-emerald-400 font-bold">
                    {entry.credit > 0 ? `₹${entry.credit.toLocaleString('en-IN')}` : '—'}
                  </td>

                  <td className="px-4 py-3 text-right font-bold text-white text-xs">
                    ₹{entry.runningBalance.toLocaleString('en-IN')}
                  </td>

                  <td className="px-4 py-3 text-center font-sans">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>{entry.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400 pt-2">
          <div className="text-[11px]">
            Showing {paginatedEntries.length} of {filteredEntries.length} records
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-[#131b2e] border border-[#1e2a42] rounded px-2 py-1 text-xs text-slate-200"
              >
                <option value={5}>5 rows</option>
                <option value={10}>10 rows</option>
                <option value={20}>20 rows</option>
              </select>
            </div>

            <div className="flex items-center gap-1 font-mono">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="w-7 h-7 rounded border border-slate-800 bg-[#131b2e] flex items-center justify-center text-slate-400 disabled:opacity-40"
              >
                &lt;
              </button>
              <span className="w-7 h-7 rounded bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                {page}
              </span>
              <button
                disabled={page * pageSize >= filteredEntries.length}
                onClick={() => setPage(p => p + 1)}
                className="w-7 h-7 rounded border border-slate-800 bg-[#131b2e] flex items-center justify-center text-slate-400 disabled:opacity-40"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
