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
  ChevronDown,
  XCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { Order } from '../../types';
import { matchesDateFilter } from '../../utils/dateUtils';

export const OrdersView: React.FC = () => {
  const {
    openOrderModal,
    refreshTrigger,
    showToast,
    triggerRefresh,
    isLiveMode,
    isCompactMode,
    ordersFilter,
    setOrdersFilter,
  } = useApp();

  const [orders, setOrders] = useState<Order[]>([]);
  const [activeStatusTab, setActiveStatusTab] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState('Today');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Consume any target ordersFilter set from Notifications
  useEffect(() => {
    if (ordersFilter) {
      if (ordersFilter.status) setActiveStatusTab(ordersFilter.status);
      if (ordersFilter.query) setSearchQuery(ordersFilter.query);
      setTimeRange('All Time');
      setOrdersFilter(null);
    }
  }, [ordersFilter, setOrdersFilter]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, activeStatusTab, timeRange]);

  useEffect(() => {
    setLoading(true);
    api.getOrders({ status: activeStatusTab, q: searchQuery, timeRange })
      .then((data) => setOrders(data))
      .catch((err) => console.error('Failed to load orders:', err))
      .finally(() => setLoading(false));
  }, [activeStatusTab, searchQuery, timeRange, refreshTrigger]);

  const handleCancelOrder = async (id: string) => {
    try {
      await api.cancelOrder(id);
      showToast(`Order ${id} cancelled successfully`, 'success');
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel order', 'error');
    }
  };

  const filteredOrders = orders.filter((o) => matchesDateFilter(o.created, timeRange));
  const paginatedOrders = filteredOrders.slice((page - 1) * pageSize, page * pageSize);

  const cellPad = isCompactMode ? 'px-2.5 py-1.5' : 'px-3.5 py-3';
  const headPad = isCompactMode ? 'px-2.5 py-2' : 'px-3.5 py-3';

  const handleExportCSV = () => {
    if (orders.length === 0) return;
    const headers = ['Order ID', 'Client ID', 'Client Name', 'Instrument', 'Exchange', 'Side', 'Type', 'Quantity', 'Price', 'Executed Qty', 'Avg Price', 'Status', 'Created Time'];
    const rows = orders.map(o => [
      o.id,
      o.clientId,
      `"${o.clientName}"`,
      o.instrument,
      o.exchange,
      o.side,
      o.type,
      o.quantity,
      o.orderPrice,
      o.executedQty,
      o.avgPrice,
      o.status,
      o.created,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NextTrade_Orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported Orders to CSV', 'success');
  };

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-white">Orders</h2>
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
              isLiveMode 
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
            }`}>
              {isLiveMode ? 'Live engine' : 'Sandbox mode'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Review and manage orders across all client accounts.
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
            onClick={() => openOrderModal(null, 'BUY')}
            className="px-3.5 py-1.5 sm:py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-colors flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-900/30"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Place Order</span>
          </button>
        </div>
      </div>

      {/* Orders Card Container */}
      <div className="p-3.5 sm:p-5 rounded-xl bg-[#111827] border border-[#1e293b] space-y-4 shadow-sm">
        {/* Status Tabs Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white">Orders</h3>
            <p className="text-[11px] text-slate-400">
              {orders.length} authoritative execution records
            </p>
          </div>

          {/* Status Tabs (All, Open, Executed, Pending, Rejected, Cancelled) */}
          <div className="flex p-0.5 rounded-lg bg-[#131b2e] border border-[#1e2a42] text-xs overflow-x-auto">
            {['All', 'Open', 'Executed', 'Pending', 'Rejected', 'Cancelled'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveStatusTab(tab)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  activeStatusTab === tab
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
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
              placeholder="Search orders (ID, client, or instrument)..."
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
                <option value="This Week">This Week</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[850px] text-xs text-left">
            <thead className="bg-[#141d30] text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className={headPad}>Order ID</th>
                <th className={headPad}>Client</th>
                <th className={headPad}>Instrument</th>
                <th className={`${headPad} text-center`}>Side</th>
                <th className={`${headPad} text-center`}>Type</th>
                <th className={`${headPad} text-right`}>Quantity</th>
                <th className={`${headPad} text-right`}>Order Price</th>
                <th className={`${headPad} text-right`}>Executed</th>
                <th className={`${headPad} text-right`}>Avg. Price</th>
                <th className={`${headPad} text-center`}>Status</th>
                <th className={`${headPad} text-right`}>Created</th>
                <th className={`${headPad} text-center`}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/60 font-mono">
              {paginatedOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-800/60 transition-colors">
                  <td className={`${cellPad} font-bold text-white text-xs`}>
                    {order.id}
                  </td>

                  <td className={`${cellPad} font-sans text-xs`}>
                    <div className="font-semibold text-slate-200">{order.clientName}</div>
                    <div className="text-[10px] text-slate-400">{order.clientId}</div>
                  </td>

                  <td className={`${cellPad} font-bold text-white text-xs`}>
                    {order.instrument}
                  </td>

                  <td className={`${cellPad} text-center`}>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      order.side === 'BUY'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      {order.side}
                    </span>
                  </td>

                  <td className={`${cellPad} text-center text-slate-400 text-xs font-sans`}>
                    {order.type}
                  </td>

                  <td className={`${cellPad} text-right text-slate-200 font-bold`}>
                    {order.quantity}
                  </td>

                  <td className={`${cellPad} text-right text-slate-200`}>
                    {typeof order.orderPrice === 'number'
                      ? `₹${order.orderPrice.toFixed(2)}`
                      : order.orderPrice}
                  </td>

                  <td className={`${cellPad} text-right text-slate-300`}>
                    {order.executedQty}
                  </td>

                  <td className={`${cellPad} text-right text-slate-300`}>
                    {order.avgPrice > 0 ? `₹${order.avgPrice.toFixed(2)}` : '—'}
                  </td>

                  <td className={`${cellPad} text-center font-sans`}>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      order.status === 'Executed'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : order.status === 'Open'
                        ? 'bg-blue-500/15 text-blue-400'
                        : order.status === 'Pending'
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-rose-500/15 text-rose-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        order.status === 'Executed'
                          ? 'bg-emerald-400'
                          : order.status === 'Open'
                          ? 'bg-blue-400'
                          : order.status === 'Pending'
                          ? 'bg-amber-400'
                          : 'bg-rose-400'
                      }`} />
                      <span>{order.status}</span>
                    </span>
                  </td>

                  <td className={`${cellPad} text-right text-slate-400 text-xs`}>
                    {order.created}
                  </td>

                  <td className={`${cellPad} text-center font-sans`}>
                    {order.status === 'Open' || order.status === 'Pending' ? (
                      <button
                        onClick={() => handleCancelOrder(order.id)}
                        className="px-2 py-1 bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white rounded text-[11px] font-bold transition-all"
                      >
                        Cancel
                      </button>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer & Pagination */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400 pt-2">
          <div className="text-[11px]">
            Showing {paginatedOrders.length} of {filteredOrders.length} orders
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
                disabled={page * pageSize >= filteredOrders.length}
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
