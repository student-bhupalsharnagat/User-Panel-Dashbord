/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, ArrowUpRight, ArrowDownRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { Client, MarketInstrument } from '../../types';

export const OrderModal: React.FC = () => {
  const { orderModalState, closeOrderModal, showToast, triggerRefresh } = useApp();
  
  const [instruments, setInstruments] = useState<MarketInstrument[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  
  const [selectedSymbol, setSelectedSymbol] = useState<string>('RELIANCE');
  const [selectedClientId, setSelectedClientId] = useState<string>('NT10482');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET' | 'SL-M'>('LIMIT');
  const [product, setProduct] = useState<'MIS' | 'NRML' | 'CNC'>('MIS');
  const [quantity, setQuantity] = useState<number>(100);
  const [price, setPrice] = useState<number>(2985);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (orderModalState.isOpen) {
      Promise.all([api.getMarketWatch(), api.getClients()]).then(([insts, cls]) => {
        setInstruments(insts);
        setClients(cls);
        if (orderModalState.instrument) {
          setSelectedSymbol(orderModalState.instrument.symbol);
          setPrice(orderModalState.instrument.lastPrice);
        } else if (insts.length > 0) {
          setSelectedSymbol(insts[0].symbol);
          setPrice(insts[0].lastPrice);
        }
        if (orderModalState.defaultSide) {
          setSide(orderModalState.defaultSide);
        }
      });
    }
  }, [orderModalState]);

  if (!orderModalState.isOpen) return null;

  const currentInst = instruments.find((i) => i.symbol === selectedSymbol) || instruments[0];
  const currentClient = clients.find((c) => c.id === selectedClientId) || clients[0];

  const estimatedOrderValue = (orderType === 'MARKET' ? (currentInst?.lastPrice || 0) : price) * quantity;
  const estimatedMargin = Math.round(estimatedOrderValue * (product === 'CNC' ? 1 : 0.2));
  const hasSufficientMargin = currentClient ? currentClient.marginAvailable >= estimatedMargin : true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInst) return;

    setIsSubmitting(true);
    try {
      await api.placeOrder({
        clientId: selectedClientId,
        instrument: currentInst.symbol,
        side,
        type: orderType,
        quantity: Number(quantity),
        orderPrice: orderType === 'MARKET' ? 'Market' : Number(price),
        product,
      });

      showToast(`${side} order for ${quantity} ${currentInst.symbol} submitted successfully`, 'success');
      triggerRefresh();
      closeOrderModal();
    } catch (err: any) {
      showToast(err.message || 'Order execution rejected', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#111827] border border-[#1e293b] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden text-slate-200 max-h-[92vh] flex flex-col">
        {/* Header with Side Tabs */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex p-0.5 rounded-lg bg-slate-900 border border-slate-800">
              <button
                type="button"
                onClick={() => setSide('BUY')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  side === 'BUY' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                BUY
              </button>
              <button
                type="button"
                onClick={() => setSide('SELL')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  side === 'SELL' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                SELL
              </button>
            </div>
            <span className="text-xs text-slate-400 font-medium">Order Execution</span>
          </div>

          <button
            onClick={closeOrderModal}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Instrument Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Instrument
            </label>
            <select
              value={selectedSymbol}
              onChange={(e) => {
                setSelectedSymbol(e.target.value);
                const inst = instruments.find((i) => i.symbol === e.target.value);
                if (inst) setPrice(inst.lastPrice);
              }}
              className="w-full bg-[#131b2e] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              {instruments.map((i) => (
                <option key={i.symbol} value={i.symbol}>
                  {i.symbol} - {i.name} ({i.exchange}) · ₹{i.lastPrice.toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          {/* Client Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Client Account
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full bg-[#131b2e] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} - {c.name} (Avail Margin: ₹{(c.marginAvailable / 100000).toFixed(2)}L)
                </option>
              ))}
            </select>
          </div>

          {/* Product Type & Order Type Tabs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Product
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-center">
                {(['MIS', 'NRML', 'CNC'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProduct(p)}
                    className={`py-1 text-[11px] font-medium rounded transition-colors ${
                      product === p ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Order Type
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-center">
                {(['LIMIT', 'MARKET', 'SL-M'] as const).map((ot) => (
                  <button
                    key={ot}
                    type="button"
                    onClick={() => setOrderType(ot)}
                    className={`py-1 text-[11px] font-medium rounded transition-colors ${
                      orderType === ot ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {ot}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quantity & Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Quantity {currentInst && `(Lot: ${currentInst.lotSize})`}
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-[#131b2e] border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Price (INR)
              </label>
              <input
                type="number"
                step="0.05"
                disabled={orderType === 'MARKET'}
                value={orderType === 'MARKET' ? (currentInst?.lastPrice || 0) : price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                className={`w-full bg-[#131b2e] border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 ${
                  orderType === 'MARKET' ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              />
            </div>
          </div>

          {/* Margin & Risk Summary Box */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Order Value:</span>
              <span className="font-mono text-slate-200">₹{estimatedOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Required Margin:</span>
              <span className="font-mono text-indigo-300 font-semibold">₹{estimatedMargin.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Available Client Margin:</span>
              <span className={`font-mono ${hasSufficientMargin ? 'text-emerald-400' : 'text-rose-400'}`}>
                ₹{(currentClient?.marginAvailable || 0).toLocaleString('en-IN')}
              </span>
            </div>
            {!hasSufficientMargin && (
              <div className="pt-1 flex items-center gap-1.5 text-rose-400 text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Insufficient margin available for this trade.</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={closeOrderModal}
              className="flex-1 py-2 text-xs font-semibold text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !hasSufficientMargin}
              className={`flex-1 py-2 text-xs font-bold text-white rounded-lg transition-all shadow-md ${
                side === 'BUY'
                  ? 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900/50'
                  : 'bg-rose-600 hover:bg-rose-500 disabled:bg-rose-900/50'
              } disabled:cursor-not-allowed`}
            >
              {isSubmitting ? 'Routing to Engine...' : `${side} ${quantity} ${currentInst?.symbol || ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
