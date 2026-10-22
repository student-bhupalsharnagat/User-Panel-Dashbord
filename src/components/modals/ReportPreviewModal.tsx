import React, { useState, useEffect } from 'react';
import { X, FileBarChart, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { matchesDateFilter } from '../../utils/dateUtils';

export const ReportPreviewModal: React.FC = () => {
  const { reportPreviewModal, closeReportPreview, showToast } = useApp();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const report = reportPreviewModal.report;
  const period = reportPreviewModal.period;

  useEffect(() => {
    if (reportPreviewModal.isOpen && report) {
      setLoading(true);
      api.getReportPreview(report.id, period)
        .then((res) => {
          setData(res.data);
        })
        .catch(() => {
          showToast('Failed to load report data', 'error');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [reportPreviewModal.isOpen, report, period]);

  const filteredData = React.useMemo(() => {
    if (!period || data.length === 0) return data;
    return data.filter((row) => {
      const dateVal = row.Date || row.date || row.Created || row.created || row.requestDate || row['Request Date'] || row['Transaction Date'];
      if (!dateVal) return true;
      return matchesDateFilter(dateVal, period);
    });
  }, [data, period]);

  if (!reportPreviewModal.isOpen || !report) return null;

  const handleExportCSV = () => {
    if (filteredData.length === 0) return;
    const headers = Object.keys(filteredData[0]).join(',');
    const rows = filteredData.map((row) =>
      Object.values(row)
        .map((val) => `"${val}"`)
        .join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${report.id}_${(period || 'period').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${report.title} to CSV`, 'success');
  };

  const columns = filteredData.length > 0 ? Object.keys(filteredData[0]) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#111827] border border-[#1e293b] rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden text-slate-200 max-h-[92vh] flex flex-col">
        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <FileBarChart className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">{report.title}</h3>
                {period && (
                  <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    {period}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">{report.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={loading || filteredData.length === 0}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={closeReportPreview}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-3.5 sm:p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="text-xs">Generating verified report preview...</span>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">No records found for period: {period || 'selected period'}.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full min-w-[550px] text-xs text-left">
                <thead className="bg-[#141d30] text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    {columns.map((col) => (
                      <th key={col} className="px-3.5 py-2.5">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-slate-900/60 font-mono">
                  {filteredData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/60 transition-colors">
                      {columns.map((col) => (
                        <td key={col} className="px-3.5 py-2.5 text-slate-300">
                          {typeof row[col] === 'number'
                            ? row[col].toLocaleString('en-IN')
                            : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>Showing verified records from authoritative ledger and order books</span>
            <span className="font-semibold text-slate-400">Total matched: {filteredData.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
