/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Bell, AlertTriangle, CheckCircle, Info, ArrowUpRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const NotificationsDrawer: React.FC = () => {
  const {
    isNotificationsOpen,
    setIsNotificationsOpen,
    setActiveTab,
    openFundActionModal,
  } = useApp();

  if (!isNotificationsOpen) return null;

  const notifications = [
    {
      id: 'notif-1',
      title: 'High Margin Utilization Alert',
      message: 'Client Meera Nair (NT10154) has exceeded 63% margin utilization on BANKNIFTY positions.',
      type: 'warning' as const,
      time: '10 mins ago',
      actionTab: 'positions',
    },
    {
      id: 'notif-2',
      title: 'New Deposit Verification Required',
      message: 'Aarav Mehta submitted ₹2,50,000 via Bank Transfer (UTR958310421). Bank proof attached.',
      type: 'info' as const,
      time: '24 mins ago',
      actionTab: 'funds',
    },
    {
      id: 'notif-3',
      title: 'Order Executed',
      message: 'ORD-98421: BUY 120 RELIANCE limit order executed at ₹2,981.90.',
      type: 'success' as const,
      time: '38 mins ago',
      actionTab: 'orders',
    },
    {
      id: 'notif-4',
      title: 'Risk Limit Exception',
      message: 'Order ORD-98416 for Kabir Rao was rejected due to insufficient client margin balance.',
      type: 'warning' as const,
      time: '1 hour ago',
      actionTab: 'orders',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-100">
      <div className="w-full max-w-full sm:max-w-sm bg-[#111827] border-l border-[#1e293b] h-full shadow-2xl flex flex-col text-slate-200">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Notifications & Risk Alerts</h3>
          </div>
          <button
            onClick={() => setIsNotificationsOpen(false)}
            className="p-1 text-slate-400 hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start gap-2.5">
                {n.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
                {n.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                {n.type === 'info' && <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white leading-tight">{n.title}</div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">{n.message}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">{n.time}</span>
                    <button
                      onClick={() => {
                        setIsNotificationsOpen(false);
                        setActiveTab(n.actionTab as any);
                      }}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-0.5"
                    >
                      <span>Review</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-slate-800 text-center">
          <button
            onClick={() => setIsNotificationsOpen(false)}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Close Alerts Drawer
          </button>
        </div>
      </div>
    </div>
  );
};
