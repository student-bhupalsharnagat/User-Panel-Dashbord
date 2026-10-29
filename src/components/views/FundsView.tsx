/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  ChevronDown,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { FundTransaction } from '../../types';
import { matchesDateFilter } from '../../utils/dateUtils';

export const FundsView: React.FC = () => {
  const {
    openFundActionModal,
    refreshTrigger,
    showToast,
    isLiveMode,
    isCompactMode,
    fundsFilter,
    setFundsFilter,
  } = useApp();

  const [transactions, setTransactions] = useState<FundTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<'Deposits' | 'Withdrawals'>('Deposits');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState('Today');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Consume any target fundsFilter set from Notifications
  useEffect(() => {
    if (fundsFilter) {
      if (fundsFilter.tab) setActiveTab(fundsFilter.tab);
      if (fundsFilter.query) setSearchQuery(fundsFilter.query);
      setTimeRange('All Time');
      setFundsFilter(null);
    }
  }, [fundsFilter, setFundsFilter]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, activeTab, timeRange]);

  useEffect(() => {
    setLoading(true);
    api.getFunds(activeTab === 'Deposits' ? 'Deposit' : 'Withdrawal', timeRange)
      .then((data) => setTransactions(data))
      .catch((err) => console.error('Failed to load fund transactions:', err))
      .finally(() => setLoading(false));
  }, [activeTab, timeRange, refreshTrigger]);

  const filteredTxns = transactions.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = (
      t.id.toLowerCase().includes(q) ||
      t.clientName.toLowerCase().includes(q) ||
      t.clientId.toLowerCase().includes(q) ||
      t.referenceId.toLowerCase().includes(q)
    );
    return matchesSearch && matchesDateFilter(t.requestDate, timeRange);
  });

  const paginatedTxns = filteredTxns.slice((page - 1) * pageSize, page * pageSize);

  const cellPad = isCompactMode ? 'px-2.5 py-1.5' : 'px-3.5 py-3';
  const headPad = isCompactMode ? 'px-2.5 py-2' : 'px-3.5 py-3';

  const handleExportCSV = () => {
    if (transactions.length === 0) return;
    const headers = ['Transaction ID', 'Client ID', 'Client Name', 'Type', 'Amount (INR)', 'Method', 'Request Date', 'Reference ID', 'Status', 'Verification'];
    const rows = transactions.map(t => [
      t.id,
      t.clientId,
      `"${t.clientName}"`,
      t.type,
      t.amount,
      t.method,
      t.requestDate,
      t.referenceId,
      t.status,
      `"${t.verification}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NextTrade_Funds_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${activeTab} transactions to CSV`, 'success');
  };

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-white">Pay-in / Pay-out</h2>
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
              isLiveMode
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
            }`}>
              {isLiveMode ? 'Live engine' : 'Sandbox mode'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Review fund requests and verification status. Actions route to authoritative ledger.
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

      {/* Main Container Card */}
      <div className="p-3.5 sm:p-5 rounded-xl bg-[#111827] border border-[#1e293b] space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white">Pay-in / Pay-out</h3>
            <p className="text-[11px] text-slate-400">
              {filteredTxns.length} records requiring clearance and audit verification
            </p>
          </div>

          {/* Deposits vs Withdrawals Tabs */}
          <div className="flex p-0.5 rounded-lg bg-[#131b2e] border border-[#1e2a42] text-xs">
            <button
              onClick={() => setActiveTab('Deposits')}
              className={`px-4 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                activeTab === 'Deposits'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Deposits
            </button>
            <button
              onClick={() => setActiveTab('Withdrawals')}
              className={`px-4 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                activeTab === 'Withdrawals'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Withdrawals
            </button>
          </div>
        </div>

        {/* Toolbar & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pay-in / pay-out (ID, client, UTR)..."
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

        {/* Transactions Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[800px] text-xs text-left">
            <thead className="bg-[#141d30] text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className={headPad}>Transaction ID</th>
                <th className={headPad}>Client</th>
                <th className={`${headPad} text-right`}>Amount</th>
                <th className={headPad}>Method</th>
                <th className={headPad}>Request Date</th>
                <th className={headPad}>Reference ID</th>
                <th className={`${headPad} text-center`}>Status</th>
                <th className={headPad}>Verification</th>
                <th className={`${headPad} text-center`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/60 font-mono">
              {paginatedTxns.map((txn) => (
                <tr key={txn.id} className="hover:bg-slate-800/60 transition-colors">
                  <td className={`${cellPad} font-bold text-white text-xs`}>
                    {txn.id}
                  </td>

                  <td className={`${cellPad} font-sans text-xs`}>
                    <div className="font-semibold text-slate-200">{txn.clientName}</div>
                    <div className="text-[10px] text-slate-400">{txn.clientId}</div>
                  </td>

                  <td className={`${cellPad} text-right font-bold text-emerald-400 text-xs`}>
                    ₹{txn.amount.toLocaleString('en-IN')}
                  </td>

                  <td className={`${cellPad} font-sans text-slate-300 text-xs`}>
                    {txn.method}
                  </td>

                  <td className={`${cellPad} text-slate-400 text-xs font-sans`}>
                    {txn.requestDate}
                  </td>

                  <td className={`${cellPad} text-indigo-300 font-bold text-xs`}>
                    {txn.referenceId}
                  </td>

                  <td className={`${cellPad} text-center font-sans`}>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      txn.status === 'Completed' || txn.status === 'Approved'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : txn.status === 'Pending'
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-rose-500/15 text-rose-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        txn.status === 'Completed' || txn.status === 'Approved'
                          ? 'bg-emerald-400'
                          : txn.status === 'Pending'
                          ? 'bg-amber-400'
                          : 'bg-rose-400'
                      }`} />
                      <span>{txn.status}</span>
                    </span>
                  </td>

                  <td className={`${cellPad} font-sans text-slate-400 text-xs truncate max-w-[180px]`}>
                    {txn.verification}
                  </td>

                  <td className={`${cellPad} text-center font-sans`}>
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => openFundActionModal(txn, 'approve')}
                        className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-300 hover:text-white transition-colors"
                        title="Approve Transaction"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openFundActionModal(txn, 'reject')}
                        className="p-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white transition-colors"
                        title="Reject with Reason"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400 pt-2">
          <div className="text-[11px]">
            Showing {paginatedTxns.length} of {filteredTxns.length} records
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
                disabled={page * pageSize >= filteredTxns.length}
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
