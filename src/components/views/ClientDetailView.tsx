/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  ShieldCheck,
  FileText,
  DollarSign,
  TrendingUp,
  Layers,
  ClipboardList,
  AlertTriangle,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { Client, Order, Position } from '../../types';

export const ClientDetailView: React.FC = () => {
  const {
    selectedClientForDetail,
    closeClientDetail,
    openOrderModal,
    openSquareOffModal,
    refreshTrigger,
  } = useApp();

  const [clientData, setClientData] = useState<Client | null>(selectedClientForDetail);
  const [clientOrders, setClientOrders] = useState<Order[]>([]);
  const [clientPositions, setClientPositions] = useState<Position[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'positions' | 'kyc'>('overview');

  useEffect(() => {
    if (selectedClientForDetail) {
      api.getClientById(selectedClientForDetail.id)
        .then((res) => {
          setClientData(res.client);
          setClientOrders(res.orders);
          setClientPositions(res.positions);
        })
        .catch(() => {});
    }
  }, [selectedClientForDetail, refreshTrigger]);

  if (!selectedClientForDetail) return null;
  const client = clientData || selectedClientForDetail;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#0f172a] border-l border-[#1e293b] h-full shadow-2xl flex flex-col text-slate-200">
        {/* Drawer Header */}
        <div className="p-3.5 sm:p-5 border-b border-slate-800 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-bold flex items-center justify-center text-xs sm:text-sm shrink-0">
              {client.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-white truncate">{client.name}</h3>
                <span className="font-mono text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                  {client.id}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  client.isDemo ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {client.isDemo ? 'Demo' : 'Live'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">{client.email} · {client.phone}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => openOrderModal(null, 'BUY')}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Place Trade</span>
            </button>
            <button
              onClick={closeClientDetail}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              aria-label="Close client details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-3.5 sm:px-5 border-b border-slate-800 flex gap-3 sm:gap-4 text-xs font-medium overflow-x-auto no-scrollbar">
          {(['overview', 'positions', 'orders', 'kyc'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 capitalize border-b-2 transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'border-indigo-500 text-white font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'kyc' ? 'KYC & Verification' : tab}
            </button>
          ))}
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'overview' && (
            <>
              {/* Financial Balance Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Ledger Balance</div>
                  <div className="text-base font-bold font-mono text-white mt-1">₹{client.ledgerBalance.toLocaleString('en-IN')}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Open P&L</div>
                  <div className={`text-base font-bold font-mono mt-1 ${client.openPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {client.openPnL >= 0 ? '+' : ''}₹{client.openPnL.toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Margin Available</div>
                  <div className="text-base font-bold font-mono text-emerald-400 mt-1">₹{client.marginAvailable.toLocaleString('en-IN')}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Margin Used</div>
                  <div className="text-base font-bold font-mono text-indigo-300 mt-1">₹{client.marginUsed.toLocaleString('en-IN')}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Peak Ledger</div>
                  <div className="text-base font-bold font-mono text-slate-300 mt-1">₹{client.peakLedger.toLocaleString('en-IN')}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Risk Limit</div>
                  <div className="text-base font-bold font-mono text-slate-300 mt-1">₹{client.riskLimit.toLocaleString('en-IN')}</div>
                </div>
              </div>

              {/* Account Information Card */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5 text-xs">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Account Specifications</h4>
                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div>
                    <span className="text-slate-500">PAN Number:</span>{' '}
                    <span className="font-mono font-semibold text-white">{client.pan}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Assigned Broker:</span>{' '}
                    <span className="font-semibold text-indigo-300">{client.brokerName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Onboarding Date:</span>{' '}
                    <span>{client.createdDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">KYC Status:</span>{' '}
                    <span className="text-emerald-400 font-semibold">{client.kycStatus}</span>
                  </div>
                </div>
              </div>

              {/* Client Open Positions Preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Open Positions ({clientPositions.length})</h4>
                  <button onClick={() => setActiveTab('positions')} className="text-xs text-indigo-400 hover:text-indigo-300">
                    Full view →
                  </button>
                </div>
                {clientPositions.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 rounded-xl bg-slate-900/60 border border-slate-800">
                    No active open positions for this client.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {clientPositions.map((pos) => (
                      <div
                        key={pos.id}
                        className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-white">{pos.instrument} ({pos.product})</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            Qty: {pos.netQty} · Avg: ₹{pos.avgPrice.toFixed(2)} · LTP: ₹{pos.currentPrice.toFixed(2)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className={`font-mono font-bold ${pos.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {pos.totalPnL >= 0 ? '+' : ''}₹{pos.totalPnL.toLocaleString('en-IN')}
                          </div>
                          <button
                            onClick={() => openSquareOffModal(pos)}
                            className="px-2 py-1 bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white rounded text-[11px] font-bold"
                          >
                            Square Off
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'positions' && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Open Positions ({clientPositions.length})</h4>
              {clientPositions.map((pos) => (
                <div
                  key={pos.id}
                  className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-white">{pos.instrument} ({pos.product})</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Net Qty: {pos.netQty} | Avg: ₹{pos.avgPrice.toFixed(2)} | Current: ₹{pos.currentPrice.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-mono font-bold text-sm ${pos.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pos.totalPnL >= 0 ? '+' : ''}₹{pos.totalPnL.toLocaleString('en-IN')}
                    </span>
                    <button
                      onClick={() => openSquareOffModal(pos)}
                      className="px-2.5 py-1 bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white rounded text-[11px] font-bold"
                    >
                      Square Off
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Order Execution History</h4>
              {clientOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      ord.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {ord.side}
                    </span>
                    <div>
                      <div className="font-bold text-white">{ord.instrument}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{ord.id} · {ord.created}</div>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-white font-semibold">Qty: {ord.quantity} @ ₹{ord.orderPrice}</div>
                    <div className="text-[10px] text-slate-400">{ord.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'kyc' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">KYC Compliance & Verification Dossier</h4>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Current KYC Clearance:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                    {client.kycStatus}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400">Verified Client Proof Documents:</div>
                  {client.kycDocuments.map((doc, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-300 p-2 rounded bg-slate-800/60">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{doc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
