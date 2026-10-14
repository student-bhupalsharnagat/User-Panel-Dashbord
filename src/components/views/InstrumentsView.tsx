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
  SlidersHorizontal,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { MarketInstrument } from '../../types';

export const InstrumentsView: React.FC = () => {
  const { refreshTrigger, showToast, triggerRefresh, isLiveMode } = useApp();

  const [instruments, setInstruments] = useState<MarketInstrument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [exchangeFilter, setExchangeFilter] = useState('All');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getInstruments()
      .then((data) => setInstruments(data))
      .catch((err) => console.error('Failed to load instruments:', err))
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  const handleToggleStatus = async (symbol: string) => {
    try {
      const updated = await api.toggleInstrument(symbol);
      showToast(`Trading status for ${symbol} set to ${updated.status}`, 'info');
      triggerRefresh();
    } catch {
      showToast('Failed to toggle status', 'error');
    }
  };

  const filteredInstruments = instruments.filter((i) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = i.name.toLowerCase().includes(q) || i.symbol.toLowerCase().includes(q);
    const matchesExchange = exchangeFilter === 'All' || i.exchange === exchangeFilter;
    return matchesSearch && matchesExchange;
  });

  const paginated = filteredInstruments.slice((page - 1) * pageSize, page * pageSize);

  const handleExportCSV = () => {
    if (instruments.length === 0) return;
    const headers = ['Instrument Name', 'Symbol', 'Exchange', 'Type', 'Contract/Expiry', 'Lot Size', 'Tick Size', 'Status'];
    const rows = instruments.map(i => [
      `"${i.name}"`,
      i.symbol,
      i.exchange,
      i.type,
      i.contractExpiry || 'EQ',
      i.lotSize,
      i.tickSize,
      i.status,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NextTrade_Instruments_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported Instruments Catalogue to CSV', 'success');
  };

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-white">Instruments</h2>
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
              isLiveMode
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
            }`}>
              {isLiveMode ? 'Live engine' : 'Demo data'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage tradeable instruments, contracts, tick sizes, and broker execution permissions.
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
            <h3 className="text-sm font-bold text-white">Instruments</h3>
            <p className="text-[11px] text-slate-400">
              {filteredInstruments.length} verified tradeable symbols in repository
            </p>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search instruments (name, symbol)..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#131b2e] border border-[#1e2a42] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex p-0.5 rounded-lg bg-[#131b2e] border border-[#1e2a42] text-xs">
              {(['All', 'NSE', 'NFO', 'BSE'] as const).map((ex) => (
                <button
                  key={ex}
                  onClick={() => setExchangeFilter(ex)}
                  className={`px-3 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    exchangeFilter === ex ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Instruments Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[800px] text-xs text-left">
            <thead className="bg-[#141d30] text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Instrument Name</th>
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3">Exchange</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Contract / Expiry</th>
                <th className="px-4 py-3 text-right">Lot Size</th>
                <th className="px-4 py-3 text-right">Tick Size</th>
                <th className="px-4 py-3 text-center">Trading Status</th>
                <th className="px-4 py-3 text-center">Permission Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/60 font-mono">
              {paginated.map((inst) => (
                <tr key={inst.symbol} className="hover:bg-slate-800/60 transition-colors">
                  <td className="px-4 py-3 font-sans font-bold text-white text-xs">
                    {inst.name}
                  </td>

                  <td className="px-4 py-3 text-indigo-300 font-bold text-xs">
                    {inst.symbol}
                  </td>

                  <td className="px-4 py-3 font-sans text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-slate-300">
                      {inst.exchange}
                    </span>
                  </td>

                  <td className="px-4 py-3 font-sans text-slate-400 text-xs">
                    {inst.type}
                  </td>

                  <td className="px-4 py-3 font-sans text-slate-300 text-xs">
                    {inst.contractExpiry || 'EQ'}
                  </td>

                  <td className="px-4 py-3 text-right text-slate-200">
                    {inst.lotSize}
                  </td>

                  <td className="px-4 py-3 text-right text-slate-400">
                    {inst.tickSize.toFixed(2)}
                  </td>

                  <td className="px-4 py-3 text-center font-sans">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      inst.status === 'Enabled'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : inst.status === 'Disabled'
                        ? 'bg-rose-500/15 text-rose-400'
                        : 'bg-amber-500/15 text-amber-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        inst.status === 'Enabled'
                          ? 'bg-emerald-400'
                          : inst.status === 'Disabled'
                          ? 'bg-rose-400'
                          : 'bg-amber-400'
                      }`} />
                      <span>{inst.status}</span>
                    </span>
                  </td>

                  <td className="px-4 py-3 text-center font-sans">
                    <button
                      onClick={() => handleToggleStatus(inst.symbol)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                        inst.status === 'Enabled'
                          ? 'border-rose-500/40 text-rose-300 hover:bg-rose-600 hover:text-white'
                          : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-600 hover:text-white'
                      }`}
                    >
                      {inst.status === 'Enabled' ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400 pt-2">
          <div className="text-[11px]">
            Showing {paginated.length} of {filteredInstruments.length} instruments
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
                disabled={page * pageSize >= filteredInstruments.length}
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
