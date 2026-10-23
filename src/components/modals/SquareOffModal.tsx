/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

export const SquareOffModal: React.FC = () => {
  const { squareOffModal, closeSquareOffModal, showToast, triggerRefresh } = useApp();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!squareOffModal.isOpen || !squareOffModal.position) return null;
  const pos = squareOffModal.position;

  const handleSquareOff = async () => {
    setIsSubmitting(true);
    try {
      const res = await api.squareOffPosition(pos.id);
      showToast(
        `Position ${pos.instrument} squared off. Realised P&L: ₹${res.pnl.toLocaleString('en-IN')}`,
        res.pnl >= 0 ? 'success' : 'info'
      );
      triggerRefresh();
      closeSquareOffModal();
    } catch (err: any) {
      showToast(err.message || 'Square-off failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#111827] border border-[#1e293b] rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden text-slate-200 max-h-[92vh] flex flex-col">
        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Square Off Position</h3>
              <p className="text-[11px] text-slate-400">Risk Management Action</p>
            </div>
          </div>
          <button
            onClick={closeSquareOffModal}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
          <p className="text-slate-300">
            Are you sure you want to trigger an immediate market square-off for client{' '}
            <span className="font-semibold text-white">{pos.clientName} ({pos.clientId})</span>?
          </p>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Instrument:</span>
              <span className="text-white font-bold">{pos.instrument} ({pos.exchange})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Net Quantity:</span>
              <span className="text-white">{pos.netQty}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Avg Entry Price:</span>
              <span className="text-slate-300">₹{pos.avgPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Current Price:</span>
              <span className="text-slate-300">₹{pos.currentPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-800">
              <span className="text-slate-400 font-sans">Current P&L:</span>
              <span className={pos.totalPnL >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {pos.totalPnL >= 0 ? '+' : ''}₹{pos.totalPnL.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={closeSquareOffModal}
              className="flex-1 py-2 text-xs font-semibold text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSquareOff}
              disabled={isSubmitting}
              className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors shadow-md disabled:opacity-50"
            >
              {isSubmitting ? 'Closing Position...' : 'Confirm Square Off'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
