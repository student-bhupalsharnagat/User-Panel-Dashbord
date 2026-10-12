/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  User,
  TrendingUp,
  FileText,
  Layers,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { Client, MarketInstrument, Order } from '../../types';

export const SearchPalette: React.FC = () => {
  const {
    isSearchOpen,
    setIsSearchOpen,
    setActiveTab,
    openOrderModal,
    openClientDetail,
  } = useApp();

  const [query, setQuery] = useState('');
  const [instruments, setInstruments] = useState<MarketInstrument[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (isSearchOpen) {
      Promise.all([
        api.getMarketWatch(),
        api.getClients(),
        api.getOrders(),
      ]).then(([insts, cls, ords]) => {
        setInstruments(insts);
        setClients(cls);
        setOrders(ords);
      }).catch(() => {});
    }
  }, [isSearchOpen]);

  if (!isSearchOpen) return null;

  const filteredInstruments = instruments.filter(i =>
    i.symbol.toLowerCase().includes(query.toLowerCase()) ||
    i.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 4);

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.id.toLowerCase().includes(query.toLowerCase()) ||
    c.email.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 4);

  const filteredOrders = orders.filter(o =>
    o.id.toLowerCase().includes(query.toLowerCase()) ||
    o.instrument.toLowerCase().includes(query.toLowerCase()) ||
    o.clientName.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 3);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-20 px-3 sm:px-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-100">
      <div className="bg-[#111827] border border-[#1e293b] rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden text-slate-200">
        {/* Search Input */}
        <div className="px-3.5 sm:px-4 py-3 sm:py-3.5 border-b border-slate-800 flex items-center gap-2.5 sm:gap-3">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients, instruments, orders..."
            className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none"
            autoFocus
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] bg-slate-800 border border-slate-700 rounded text-slate-400 font-mono">
            ESC
          </kbd>
          <button
            onClick={() => setIsSearchOpen(false)}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
            aria-label="Close search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Results */}
        <div className="max-h-[70vh] sm:max-h-96 overflow-y-auto p-3 space-y-4">
          {/* Quick Screen Nav */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
              Workspaces & Screens
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
              {[
                { name: 'Dashboard', tab: 'dashboard' },
                { name: 'Market Watch', tab: 'market_watch' },
                { name: 'Clients Directory', tab: 'clients' },
                { name: 'Live Orders', tab: 'orders' },
                { name: 'Positions & P&L', tab: 'positions' },
                { name: 'Pay-in / Pay-out', tab: 'funds' },
                { name: 'Ledger & Balance', tab: 'account_ledger' },
                { name: 'Analytics', tab: 'analytics' },
                { name: 'Audit Logs', tab: 'action_logs' },
                { name: 'Reports', tab: 'reports' },
                { name: 'Instruments', tab: 'instruments' },
                { name: 'Settings', tab: 'settings' },
              ].map((s) => (
                <button
                  key={s.tab}
                  onClick={() => {
                    setActiveTab(s.tab as any);
                    setIsSearchOpen(false);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center justify-between"
                >
                  <span>{s.name}</span>
                  <ArrowRight className="w-3 h-3 text-slate-600" />
                </button>
              ))}
            </div>
          </div>

          {/* Instruments */}
          {filteredInstruments.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
                Market Instruments
              </div>
              <div className="space-y-1">
                {filteredInstruments.map((inst) => (
                  <div
                    key={inst.symbol}
                    className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-800 flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">
                        {inst.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">{inst.symbol}</div>
                        <div className="text-[11px] text-slate-400">{inst.name} · {inst.exchange}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs font-mono font-medium text-white">₹{inst.lastPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        <div className={`text-[10px] font-mono ${inst.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {inst.change >= 0 ? '+' : ''}{inst.changePercent}%
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setIsSearchOpen(false);
                          openOrderModal(inst, 'BUY');
                        }}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-semibold"
                      >
                        Trade
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clients */}
          {filteredClients.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
                Clients
              </div>
              <div className="space-y-1">
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    onClick={() => {
                      setIsSearchOpen(false);
                      openClientDetail(client);
                    }}
                    className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-800 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">{client.name}</div>
                        <div className="text-[11px] text-slate-400">{client.id} · {client.email}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-medium text-slate-200">
                        ₹{(client.ledgerBalance / 100000).toFixed(2)} L
                      </div>
                      <div className="text-[10px] text-emerald-400">{client.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Orders */}
          {filteredOrders.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
                Recent Orders
              </div>
              <div className="space-y-1">
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    onClick={() => {
                      setIsSearchOpen(false);
                      setActiveTab('orders');
                    }}
                    className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-800 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        order.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {order.side}
                      </span>
                      <div>
                        <div className="text-xs font-semibold text-white">{order.instrument}</div>
                        <div className="text-[11px] text-slate-400">{order.id} · {order.clientName}</div>
                      </div>
                    </div>
                    <div className="text-right text-xs font-mono text-slate-300">
                      {order.quantity} qty · {order.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
