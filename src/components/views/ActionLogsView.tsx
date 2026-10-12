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
  Clock,
  Shield,
  Eye,
  ChevronDown,
  X,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { AuditLog } from '../../types';

export const ActionLogsView: React.FC = () => {
  const { refreshTrigger, showToast } = useApp();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [timeRange, setTimeRange] = useState('Today');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getAuditLogs()
      .then((data) => setLogs(data))
      .catch((err) => console.error('Failed to load audit logs:', err))
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  const filteredLogs = logs.filter((l) => {
    const q = searchQuery.toLowerCase();
    return (
      l.user.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      l.relatedEntity.toLowerCase().includes(q) ||
      l.role.toLowerCase().includes(q)
    );
  });

  const paginatedLogs = filteredLogs.slice((page - 1) * pageSize, page * pageSize);

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Timestamp', 'User', 'Role', 'Action Performed', 'Related Entity', 'IP Address', 'Result', 'Details'];
    const rows = logs.map(l => [
      `"${l.timestamp}"`,
      `"${l.user}"`,
      l.role,
      `"${l.action}"`,
      l.relatedEntity,
      l.ipAddress,
      l.result,
      `"${l.details}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NextTrade_ActionLogs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported Audit Action Logs to CSV', 'success');
  };

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-white">Action Logs</h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              Demo data
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit administrative and operational activity across your organisation.
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

      {/* Action Logs Card Container */}
      <div className="p-3.5 sm:p-5 rounded-xl bg-[#111827] border border-[#1e293b] space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white">Action Logs</h3>
            <p className="text-[11px] text-slate-400">
              {filteredLogs.length} immutable security audit trail events
            </p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search action logs (user, action, entity)..."
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
                <option value="All Time">All Time</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Action Logs Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[800px] text-xs text-left">
            <thead className="bg-[#141d30] text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-3.5 py-3">Timestamp</th>
                <th className="px-3.5 py-3">User / Staff</th>
                <th className="px-3.5 py-3">Role</th>
                <th className="px-3.5 py-3">Action Performed</th>
                <th className="px-3.5 py-3">Related Entity</th>
                <th className="px-3.5 py-3 font-mono">IP Address</th>
                <th className="px-3.5 py-3 text-center">Result</th>
                <th className="px-3.5 py-3 text-center">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/60 font-mono">
              {paginatedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/60 transition-colors">
                  <td className="px-3.5 py-3 font-sans text-slate-400 text-xs">
                    {log.timestamp}
                  </td>

                  <td className="px-3.5 py-3 font-sans font-semibold text-white">
                    {log.user}
                  </td>

                  <td className="px-3.5 py-3 font-sans text-slate-300">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-medium text-slate-300">
                      {log.role}
                    </span>
                  </td>

                  <td className="px-3.5 py-3 font-sans font-medium text-slate-200">
                    {log.action}
                  </td>

                  <td className="px-3.5 py-3 text-indigo-300 font-bold">
                    {log.relatedEntity}
                  </td>

                  <td className="px-3.5 py-3 text-slate-400">
                    {log.ipAddress}
                  </td>

                  <td className="px-3.5 py-3 text-center font-sans">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      log.result === 'Success'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : log.result === 'Warning'
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-rose-500/15 text-rose-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        log.result === 'Success'
                          ? 'bg-emerald-400'
                          : log.result === 'Warning'
                          ? 'bg-amber-400'
                          : 'bg-rose-400'
                      }`} />
                      <span>{log.result}</span>
                    </span>
                  </td>

                  <td className="px-3.5 py-3 text-center font-sans">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                      title="Inspect Log Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400 pt-2">
          <div className="text-[11px]">
            Showing {paginatedLogs.length} of {filteredLogs.length} records
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
                disabled={page * pageSize >= filteredLogs.length}
                onClick={() => setPage(p => p + 1)}
                className="w-7 h-7 rounded border border-slate-800 bg-[#131b2e] flex items-center justify-center text-slate-400 disabled:opacity-40"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#111827] border border-[#1e293b] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden text-slate-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Audit Event Details</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Timestamp:</span>
                  <span className="font-mono text-white">{selectedLog.timestamp}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Actor:</span>
                  <span className="font-semibold text-white">{selectedLog.user} ({selectedLog.role})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Action:</span>
                  <span className="text-indigo-300 font-semibold">{selectedLog.action}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Target Entity:</span>
                  <span className="font-mono font-bold text-white">{selectedLog.relatedEntity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">IP Address:</span>
                  <span className="font-mono text-slate-300">{selectedLog.ipAddress}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={`font-bold ${selectedLog.result === 'Success' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {selectedLog.result}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Full Payload & Description
                </label>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 leading-relaxed font-sans">
                  {selectedLog.details}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold text-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
