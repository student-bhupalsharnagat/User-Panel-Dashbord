/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[110] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto p-3 rounded-xl border shadow-2xl backdrop-blur-md flex items-start gap-2.5 text-xs text-white transition-all animate-in slide-in-from-bottom-2 duration-150 ${
            toast.type === 'success'
              ? 'bg-[#101b2a]/95 border-emerald-500/40 text-emerald-100'
              : toast.type === 'error'
              ? 'bg-[#221319]/95 border-rose-500/40 text-rose-100'
              : 'bg-[#151928]/95 border-indigo-500/40 text-indigo-100'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
          {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />}

          <div className="flex-1 min-w-0">
            <p className="leading-snug">{toast.message}</p>
            {toast.time && <span className="text-[10px] opacity-60 mt-0.5 block">{toast.time}</span>}
          </div>

          <button
            onClick={() => removeToast(toast.id)}
            className="p-1 opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
