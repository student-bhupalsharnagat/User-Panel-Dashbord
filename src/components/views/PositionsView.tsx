/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Search,
  Download,
  FileText,
  TrendingUp,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { Position } from '../../types';

export const PositionsView: React.FC = () => {
  const {
    openSquareOffModal,
    refreshTrigger,
    showToast,
    isLiveMode,
  } = useApp();

  const [positions, setPositions] = useState<Position[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState('All');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getPositions()
      .then((data) => {
        setPositions(data.positions);
        setSummary(data.summary);
      })
      .catch((err) => console.error('Failed to load positions:', err))
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  const filteredPositions = positions.filter((p) => {
    const matchesSearch =
      p.instrument.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.clientId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProduct = productFilter === 'All' || p.product === productFilter;
    return matchesSearch && matchesProduct;
  });

  const paginatedPositions = filteredPositions.slice((page - 1) * pageSize, page * pageSize);

  const handleExportCSV = () => {
    if (positions.length === 0) return;
    const headers = ['Client ID', 'Client Name', 'Instrument', 'Exchange', 'Product', 'Buy Qty', 'Sell Qty', 'Net Qty', 'Avg Price', 'Current Price', 'Realised PnL', 'Unrealised PnL', 'Total PnL', 'Margin Used'];
    const rows = positions.map(p => [
      p.clientId,
      `"${p.clientName}"`,
      p.instrument,
      p.exchange,
      p.product,
      p.buyQty,
      p.sellQty,
      p.netQty,
      p.avgPrice,
      p.currentPrice,
      p.realisedPnL,
      p.unrealisedPnL,
      p.totalPnL,
      p.marginUsed,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NextTrade_Positions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported Open Positions to CSV', 'success');
  };

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-white">Positions</h2>
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
              isLiveMode
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
            }`}>
              {isLiveMode ? 'Live engine' : 'Demo data'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Track open positions, exposure, and mark-to-market profit or loss.
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

      {/* KPI Cards (4 cards from Page 7 Design) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#111827] border border-[#1e293b]">
          <div className="text-xs font-semibold text-slate-400 mb-2">Total realised P&L</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
            +₹{summary?.totalRealisedPnLL || '10.59'} L
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Booked profit across accounts</div>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-[#1e293b]">
          <div className="text-xs font-semibold text-slate-400 mb-2">Unrealised P&L</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
            +₹{summary?.unrealisedPnLL || '3.89'} L
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Live MTM floating value</div>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-[#1e293b]">
          <div className="text-xs font-semibold text-slate-400 mb-2">Net P&L</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
            +₹{summary?.netPnLL || '14.48'} L
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Net portfolio profit</div>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-[#1e293b]">
          <div className="text-xs font-semibold text-slate-400 mb-2">Margin used</div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">
            ₹{summary?.marginUtilisedCr || '7.28'} Cr
          </div>
          <div className="text-[11px] text-indigo-400 mt-1 font-medium">Active exposure coverage</div>
        </div>
      </div>

      {/* Positions Card Container */}
      <div className="p-5 rounded-xl bg-[#111827] border border-[#1e293b] space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white">Positions</h3>
            <p className="text-[11px] text-slate-400">
              {positions.length} active positions in portfolio
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-slate-400 font-mono">Live Mark-to-Market ticks</span>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search positions (instrument, client name)..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#131b2e] border border-[#1e2a42] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex p-0.5 rounded-lg bg-[#131b2e] border border-[#1e2a42] text-xs">
              {(['All', 'MIS', 'NRML', 'CNC'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setProductFilter(p)}
                  className={`px-3 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    productFilter === p ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Positions Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[850px] text-xs text-left">
            <thead className="bg-[#141d30] text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-3.5 py-3">Client</th>
                <th className="px-3.5 py-3">Instrument</th>
                <th className="px-3.5 py-3">Exchange</th>
                <th className="px-3.5 py-3 text-center">Product</th>
                <th className="px-3.5 py-3 text-right">Buy Qty</th>
                <th className="px-3.5 py-3 text-right">Sell Qty</th>
                <th className="px-3.5 py-3 text-right">Net Qty</th>
                <th className="px-3.5 py-3 text-right">Avg. Price</th>
                <th className="px-3.5 py-3 text-right">Current Price</th>
                <th className="px-3.5 py-3 text-right">Realised P&L</th>
                <th className="px-3.5 py-3 text-right">Unrealised P&L</th>
                <th className="px-3.5 py-3 text-right">Total P&L</th>
                <th className="px-3.5 py-3 text-right">Margin Used</th>
                <th className="px-3.5 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/60 font-mono">
              {paginatedPositions.map((pos) => {
                const isPositiveTotal = pos.totalPnL >= 0;
                return (
                  <tr key={pos.id} className="hover:bg-slate-800/60 transition-colors">
                    <td className="px-3.5 py-3 font-sans text-xs">
                      <div className="font-semibold text-slate-200">{pos.clientName}</div>
                      <div className="text-[10px] text-slate-400">{pos.clientId}</div>
                    </td>

                    <td className="px-3.5 py-3 font-bold text-white text-xs">
                      {pos.instrument}
                    </td>

                    <td className="px-3.5 py-3 text-slate-400 font-sans text-xs">
                      {pos.exchange}
                    </td>

                    <td className="px-3.5 py-3 text-center font-sans">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-300">
                        {pos.product}
                      </span>
                    </td>

                    <td className="px-3.5 py-3 text-right text-slate-300">
                      {pos.buyQty}
                    </td>

                    <td className="px-3.5 py-3 text-right text-slate-300">
                      {pos.sellQty}
                    </td>

                    <td className={`px-3.5 py-3 text-right font-bold ${pos.netQty >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pos.netQty >= 0 ? '+' : ''}{pos.netQty}
                    </td>

                    <td className="px-3.5 py-3 text-right text-slate-200">
                      ₹{pos.avgPrice.toFixed(2)}
                    </td>

                    <td className="px-3.5 py-3 text-right font-bold text-white">
                      ₹{pos.currentPrice.toFixed(2)}
                    </td>

                    <td className={`px-3.5 py-3 text-right ${pos.realisedPnL >= 0 ? 'text-slate-300' : 'text-rose-400'}`}>
                      {pos.realisedPnL !== 0 ? `₹${pos.realisedPnL.toLocaleString('en-IN')}` : '₹0'}
                    </td>

                    <td className={`px-3.5 py-3 text-right font-medium ${pos.unrealisedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pos.unrealisedPnL >= 0 ? '+' : ''}₹{pos.unrealisedPnL.toLocaleString('en-IN')}
                    </td>

                    <td className={`px-3.5 py-3 text-right font-bold ${isPositiveTotal ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isPositiveTotal ? '+' : ''}₹{pos.totalPnL.toLocaleString('en-IN')}
                    </td>

                    <td className="px-3.5 py-3 text-right text-slate-300">
                      ₹{pos.marginUsed.toLocaleString('en-IN')}
                    </td>

                    <td className="px-3.5 py-3 text-center font-sans">
                      <button
                        onClick={() => openSquareOffModal(pos)}
                        className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white rounded text-[11px] font-bold transition-all"
                      >
                        Square Off
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400 pt-2">
          <div className="text-[11px]">
            Showing {paginatedPositions.length} of {positions.length} open positions
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
                disabled={page * pageSize >= positions.length}
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
