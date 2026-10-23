/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle, FileText, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

export const FundActionModal: React.FC = () => {
  const { fundActionModal, closeFundActionModal, showToast, triggerRefresh } = useApp();
  const [rejectReason, setRejectReason] = useState(
    'Beneficiary bank IFSC code does not match registered bank account details'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!fundActionModal.isOpen || !fundActionModal.transaction) return null;
  const txn = fundActionModal.transaction;
  const isApprove = fundActionModal.actionType === 'approve';

  const handleAction = async () => {
    setIsSubmitting(true);
    try {
      if (isApprove) {
        await api.approveFund(txn.id);
        showToast(`Transaction ${txn.id} approved. Client ledger updated.`, 'success');
      } else {
        await api.rejectFund(txn.id, rejectReason);
        showToast(`Transaction ${txn.id} rejected.`, 'info');
      }
      triggerRefresh();
      closeFundActionModal();
    } catch (err: any) {
      showToast(err.message || 'Operation failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#111827] border border-[#1e293b] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden text-slate-200 max-h-[92vh] flex flex-col">
        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            {isApprove ? (
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-white">
                {isApprove ? `Approve ${txn.type}` : `Reject ${txn.type}`}
              </h3>
              <p className="text-[11px] text-slate-400">{txn.id} · Verification review</p>
            </div>
          </div>
          <button
            onClick={closeFundActionModal}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Transaction Metadata */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Client:</span>
              <span className="font-semibold text-white">{txn.clientName} ({txn.clientId})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Amount:</span>
              <span className="font-mono font-bold text-base text-emerald-400">₹{txn.amount.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Method:</span>
              <span className="text-slate-300">{txn.method}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Reference / UTR:</span>
              <span className="font-mono text-indigo-300">{txn.referenceId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Date Requested:</span>
              <span className="text-slate-300">{txn.requestDate}</span>
            </div>
            {txn.proofDocument && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
                <span className="text-slate-400 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{txn.proofDocument}</span>
                </span>
                <span className="text-emerald-400 font-medium">Valid receipt</span>
              </div>
            )}
          </div>

          {!isApprove && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Rejection Reason *
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-[#131b2e] border border-slate-700/80 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {isApprove && (
            <p className="text-[11px] text-slate-400">
              Upon confirmation, the client ledger balance will be credited/debited and the authoritative settlement entry posted automatically.
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={closeFundActionModal}
              className="flex-1 py-2 text-xs font-semibold text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleAction}
              disabled={isSubmitting}
              className={`flex-1 py-2 text-xs font-bold text-white rounded-lg transition-colors shadow-md ${
                isApprove ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
              } disabled:opacity-50`}
            >
              {isSubmitting ? 'Processing...' : isApprove ? 'Confirm Approval' : 'Confirm Rejection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
