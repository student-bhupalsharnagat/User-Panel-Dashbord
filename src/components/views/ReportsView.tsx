/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileBarChart,
  Users,
  BookOpen,
  ClipboardList,
  Layers,
  ArrowLeftRight,
  TrendingUp,
  DollarSign,
  FileSpreadsheet,
  Eye,
  Download,
  ChevronDown,
  Filter,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { ReportItem } from '../../types';

export const ReportsView: React.FC = () => {
  const { openReportPreview, showToast, isLiveMode } = useApp();

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [period, setPeriod] = useState('This month');
  const [clientFilter, setClientFilter] = useState('All clients');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getReports()
      .then((data) => setReports(data))
      .catch((err) => console.error('Failed to load reports:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleApplyFilters = () => {
    showToast(`Applied filters: ${period} · ${clientFilter}`, 'info');
  };

  const getReportIcon = (type: string) => {
    switch (type) {
      case 'clients': return Users;
      case 'ledger': return BookOpen;
      case 'orders': return ClipboardList;
      case 'positions': return Layers;
      case 'funds': return ArrowLeftRight;
      case 'turnover': return TrendingUp;
      case 'brokerage': return DollarSign;
      default: return FileSpreadsheet;
    }
  };

  const handleQuickExport = async (report: ReportItem) => {
    try {
      const res = await api.getReportPreview(report.id);
      if (res.data.length === 0) {
        showToast('No records to export', 'error');
        return;
      }
      const headers = Object.keys(res.data[0]).join(',');
      const rows = res.data.map((row) =>
        Object.values(row).map((v) => `"${v}"`).join(',')
      );
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `${report.id}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Exported ${report.title} to CSV`, 'success');
    } catch {
      showToast('Export failed', 'error');
    }
  };

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-white">Reports</h2>
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
              isLiveMode
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
            }`}>
              {isLiveMode ? 'Live engine' : 'Sandbox mode'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Generate and export business, trading, and compliance reports.
          </p>
        </div>
      </div>

      {/* Filter Controls Bar (Page 13 Design) */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-[#111827] border border-[#1e293b] flex flex-wrap items-end gap-3 text-xs">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Reporting Period
          </label>
          <div className="relative">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-[#131b2e] border border-[#1e2a42] text-xs text-slate-200 rounded-lg px-3 py-2 pr-8 appearance-none focus:outline-none cursor-pointer"
            >
              <option value="This month">This month</option>
              <option value="Today">Today</option>
              <option value="Last 30 days">Last 30 days</option>
              <option value="Fiscal Q1">Fiscal Q1 (Apr - Jun)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Client
          </label>
          <div className="relative">
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="bg-[#131b2e] border border-[#1e2a42] text-xs text-slate-200 rounded-lg px-3 py-2 pr-8 appearance-none focus:outline-none cursor-pointer"
            >
              <option value="All clients">All clients</option>
              <option value="Active only">Active accounts only</option>
              <option value="Live accounts only">Live accounts only (exclude demo)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <button
          onClick={handleApplyFilters}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer shadow-sm"
        >
          Apply filters
        </button>
      </div>

      {/* Grid of 8 Report Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {reports.map((report) => {
          const Icon = getReportIcon(report.type);
          return (
            <div
              key={report.id}
              className="p-5 rounded-xl bg-[#111827] border border-[#1e293b] flex flex-col justify-between hover:border-slate-700 transition-all shadow-sm group"
            >
              <div>
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3 group-hover:bg-indigo-500/20 transition-colors">
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">{report.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4 min-h-[36px]">
                  {report.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => openReportPreview(report)}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#131b2e] hover:bg-slate-800 border border-[#1e2a42] text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={() => handleQuickExport(report)}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#131b2e] hover:bg-slate-800 border border-[#1e2a42] text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>Export</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
