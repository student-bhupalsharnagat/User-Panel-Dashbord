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
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { MarketInstrument } from '../../types';

export const MarketWatchView: React.FC = () => {
  const {
    openOrderModal,
    refreshTrigger,
    showToast,
    isRealtimeConnected,
    lastTickTimestamp,
    isLiveMode,
  } = useApp();

  const [instruments, setInstruments] = useState<MarketInstrument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [timeRange, setTimeRange] = useState<string>('Today');
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  // Load instruments
  useEffect(() => {
    setLoading(true);
    api.getMarketWatch()
      .then((data) => {
        setInstruments(data);
      })
      .catch((err) => {
        console.error('Failed to load market instruments:', err);
      })
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  const filteredInstruments = instruments.filter((inst) => {
    const matchesSearch =
      inst.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'All' || inst.type === selectedType;
    return matchesSearch && matchesType;
  });

  const paginatedInstruments = filteredInstruments.slice((page - 1) * pageSize, page * pageSize);

  const handleExportCSV = () => {
    if (instruments.length === 0) return;
    const headers = ['Symbol', 'Name', 'Exchange', 'LTP', 'Change', 'Change %', 'Bid', 'Ask', 'Volume', 'Status'];
    const rows = instruments.map((i) => [
      i.symbol,
      `"${i.name}"`,
      i.exchange,
      i.lastPrice,
      i.change,
      `${i.changePercent}%`,
      i.bid,
      i.ask,
      i.volume,
      i.status,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NextTrade_MarketWatch_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported Market Watch list to CSV', 'success');
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-white">Market Watch</h2>
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
              isLiveMode
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
            }`}>
              {isLiveMode ? 'Live engine' : 'Demo data'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor instruments and market movement from an institutional streaming feed.
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
            onClick={handleExportPDF}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg bg-[#131b2e] border border-[#1e2a42] hover:bg-slate-800 text-xs font-medium text-slate-200 hover:text-white transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Main Watchlist Card */}
      <div className="p-3.5 sm:p-5 rounded-xl bg-[#111827] border border-[#1e293b] space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white">Primary watchlist</h3>
            <p className="text-[11px] text-slate-400">
              {filteredInstruments.length} demonstration live records · Broadcast ticks: {lastTickTimestamp}
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-amber-400">
            <span className={`w-2 h-2 rounded-full ${isRealtimeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-[11px] text-slate-400 font-mono">
              {isRealtimeConnected ? 'Live streaming (WebSocket / SSE)' : 'Delayed demo feed'}
            </span>
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
              placeholder="Search market watch (e.g. NIFTY, RELIANCE, TCS)..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#131b2e] border border-[#1e2a42] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Instrument Segment Filter */}
            <div className="flex p-0.5 rounded-lg bg-[#131b2e] border border-[#1e2a42] text-xs">
              {(['All', 'Index', 'Equity', 'Futures'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedType(t)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    selectedType === t ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="relative">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="bg-[#131b2e] border border-[#1e2a42] text-xs text-slate-300 rounded-lg px-2.5 py-1.5 pr-7 appearance-none focus:outline-none cursor-pointer"
              >
                <option value="Today">Today</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* High-Density Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[700px] text-xs text-left">
            <thead className="bg-[#141d30] text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Instrument</th>
                <th className="px-4 py-3">Exchange</th>
                <th className="px-4 py-3 text-right">Last Traded Price</th>
                <th className="px-4 py-3 text-right">Change</th>
                <th className="px-4 py-3 text-right">Change %</th>
                <th className="px-4 py-3 text-right">Bid</th>
                <th className="px-4 py-3 text-right">Ask</th>
                <th className="px-4 py-3 text-right">Volume</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/60 font-mono">
              {paginatedInstruments.map((inst) => {
                const isPositive = inst.change >= 0;
                return (
                  <tr key={inst.symbol} className="hover:bg-slate-800/60 transition-colors group">
                    <td className="px-4 py-3 font-sans">
                      <div className="font-bold text-white text-xs">{inst.symbol}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[160px]">{inst.name}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-sans">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-300">
                        {inst.exchange}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-white text-xs">
                      ₹{inst.lastPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isPositive ? '+' : ''}{inst.change.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isPositive ? '+' : ''}{inst.changePercent.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400">
                      ₹{inst.bid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400">
                      ₹{inst.ask.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {inst.volume}
                    </td>
                    <td className="px-4 py-3 text-center font-sans">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openOrderModal(inst, 'BUY')}
                          className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-300 hover:text-white rounded text-[11px] font-bold transition-all"
                        >
                          BUY
                        </button>
                        <button
                          onClick={() => openOrderModal(inst, 'SELL')}
                          className="px-2.5 py-1 bg-rose-600/30 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white rounded text-[11px] font-bold transition-all"
                        >
                          SELL
                        </button>
                      </div>
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
            Showing {paginatedInstruments.length} of {filteredInstruments.length} records
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
