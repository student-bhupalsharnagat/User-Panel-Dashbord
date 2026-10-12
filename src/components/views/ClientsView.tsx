/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  Search,
  Filter,
  Download,
  FileText,
  Eye,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  Activity,
  ArrowUpRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { Client } from '../../types';

export const ClientsView: React.FC = () => {
  const {
    openClientDetail,
    setIsAddClientOpen,
    refreshTrigger,
    showToast,
  } = useApp();

  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [hideDemo, setHideDemo] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getClients({ q: searchQuery, status: statusFilter, hideDemo })
      .then((data) => setClients(data))
      .catch((err) => console.error('Failed to load clients:', err))
      .finally(() => setLoading(false));
  }, [searchQuery, statusFilter, hideDemo, refreshTrigger]);

  const activeCount = clients.filter(c => c.status === 'Active').length;
  const inactiveCount = clients.filter(c => c.status !== 'Active').length;
  const paginatedClients = clients.slice((page - 1) * pageSize, page * pageSize);

  const handleExportCSV = () => {
    if (clients.length === 0) return;
    const headers = ['Client ID', 'Name', 'Email', 'Phone', 'PAN', 'Status', 'Demo', 'Ledger Balance', 'Open PnL', 'Margin Used', 'Margin Available'];
    const rows = clients.map(c => [
      c.id,
      `"${c.name}"`,
      c.email,
      c.phone,
      c.pan,
      c.status,
      c.isDemo ? 'Yes' : 'No',
      c.ledgerBalance,
      c.openPnL,
      c.marginUsed,
      c.marginAvailable,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NextTrade_Clients_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported Client Directory to CSV', 'success');
  };

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-white">Clients</h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              Demo data
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage client accounts, balances, margins, and access hierarchies.
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
          <button
            onClick={() => setIsAddClientOpen(true)}
            className="px-3.5 py-1.5 sm:py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-colors flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-900/30"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ New client</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row (4 cards from Page 4 Design) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#111827] border border-[#1e293b]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Active clients</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">2,142</div>
          <div className="text-[11px] text-emerald-400 font-medium mt-1">+12 this month</div>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-[#1e293b]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Inactive clients</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">344</div>
          <div className="text-[11px] text-slate-400 mt-1">13.8% of book</div>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-[#1e293b]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Total clients</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">2,486</div>
          <div className="text-[11px] text-emerald-400 font-medium mt-1">+12.1% this month</div>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-[#1e293b]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">New today</span>
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">28</div>
          <div className="text-[11px] text-cyan-400 font-medium mt-1">+6 vs yesterday</div>
        </div>
      </div>

      {/* Client Directory Card */}
      <div className="p-5 rounded-xl bg-[#111827] border border-[#1e293b] space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white">Client directory</h3>
            <p className="text-[11px] text-slate-400">
              {clients.length} matching client records · Updated moments ago
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-emerald-400 font-mono">Live connection</span>
          </div>
        </div>

        {/* Search & Filters Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Client ID, username, name, or mobile..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#131b2e] border border-[#1e2a42] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Hide Demo ID Toggle */}
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideDemo}
                onChange={(e) => setHideDemo(e.target.checked)}
                className="sr-only"
              />
              <span className="text-[11px] text-slate-400">Hide Demo ID</span>
              {hideDemo ? (
                <ToggleRight className="w-5 h-5 text-indigo-400" />
              ) : (
                <ToggleLeft className="w-5 h-5 text-slate-500" />
              )}
            </label>

            {/* Status Filter Dropdown */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#131b2e] border border-[#1e2a42] text-xs text-slate-300 rounded-lg px-3 py-1.5 pr-8 appearance-none focus:outline-none cursor-pointer"
              >
                <option value="All statuses">All statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Suspended">Suspended</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Clients Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[800px] text-xs text-left">
            <thead className="bg-[#141d30] text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-3 py-3 text-center">View / Actions</th>
                <th className="px-3 py-3">Client ID</th>
                <th className="px-3 py-3">Client Name</th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="px-3 py-3 text-right">Ledger Balance</th>
                <th className="px-3 py-3 text-right">Open P&L</th>
                <th className="px-3 py-3 text-right">Peak Ledger</th>
                <th className="px-3 py-3 text-right">Margin Used</th>
                <th className="px-3 py-3 text-right">Income</th>
                <th className="px-3 py-3 text-right">Margin Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/60 font-mono">
              {paginatedClients.map((client) => {
                const isPositivePnL = client.openPnL >= 0;
                return (
                  <tr
                    key={client.id}
                    className="hover:bg-slate-800/60 transition-colors group cursor-pointer"
                    onClick={() => openClientDetail(client)}
                  >
                    <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openClientDetail(client)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white transition-colors"
                        title="View Full Client Profile & Ledger"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>

                    <td className="px-3 py-3 font-sans">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-xs">{client.id}</span>
                        <span className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                          client.isDemo ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {client.isDemo ? 'Demo' : 'Live'}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-3 font-sans text-xs font-semibold text-slate-200">
                      {client.name}
                    </td>

                    <td className="px-3 py-3 text-center font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        client.status === 'Active'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {client.status}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-right font-bold text-white text-xs">
                      ₹{client.ledgerBalance.toLocaleString('en-IN')}
                    </td>

                    <td className={`px-3 py-3 text-right font-medium ${isPositivePnL ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isPositivePnL ? '+' : ''}₹{client.openPnL.toLocaleString('en-IN')}
                    </td>

                    <td className="px-3 py-3 text-right text-slate-400">
                      ₹{client.peakLedger.toLocaleString('en-IN')}
                    </td>

                    <td className="px-3 py-3 text-right text-slate-300">
                      ₹{client.marginUsed.toLocaleString('en-IN')}
                    </td>

                    <td className="px-3 py-3 text-right text-slate-400">
                      ₹{client.income.toLocaleString('en-IN')}
                    </td>

                    <td className="px-3 py-3 text-right font-bold text-emerald-400">
                      ₹{client.marginAvailable.toLocaleString('en-IN')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer & Pagination */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400 pt-2">
          <div className="text-[11px]">
            Showing {paginatedClients.length} of {clients.length} clients
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
                disabled={page * pageSize >= clients.length}
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
