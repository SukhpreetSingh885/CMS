import React, { useState, useEffect, useMemo } from 'react';
import { dailyReportService, clientService } from '../../services';
import { DailyReport, Client } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { FileText, Plus, Eye, Paperclip, Download, Briefcase, Layers, CheckSquare, Clock } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSmartFilters } from '../../hooks/useSmartFilters';
import {
  FilterToolbar,
  SearchInput,
  FilterSelect,
  DateQuickFilter,
} from '../../components/filters';

export const MyReports: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const reportIdParam = searchParams.get('reportId');

  const { filters, setFilter, setFilters, clearFilter, clearAllFilters, activeFiltersCount } =
    useSmartFilters({
      search: '',
      clientId: '',
      dateRange: '',
      startDate: '',
      endDate: '',
    });

  const [reports, setReports] = useState<DailyReport[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);

  // Deep-linking: automatically open report modal when ?reportId=... is provided
  useEffect(() => {
    if (!reportIdParam) return;

    const found = reports.find((r) => r.id === reportIdParam);
    if (found) {
      setSelectedReport(found);
      return;
    }

    let isSubscribed = true;
    dailyReportService
      .getReportById(reportIdParam)
      .then((rep) => {
        if (isSubscribed && rep) {
          setSelectedReport(rep);
        }
      })
      .catch(() => {});

    return () => {
      isSubscribed = false;
    };
  }, [reportIdParam, reports]);

  const handleCloseModal = () => {
    setSelectedReport(null);
    if (searchParams.get('reportId')) {
      searchParams.delete('reportId');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const loadClients = async () => {
    try {
      const res = await clientService.getMyClients({ pageSize: 100 });
      setClients(res.data || []);
    } catch {
      // Handled
    }
  };

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const res = await dailyReportService.getMyReports({
        search: filters.search || undefined,
        clientId: filters.clientId || undefined,
        dateRange: (filters.dateRange as any) || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        pageSize: 100,
      });
      setReports(res.data || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    loadReports();
  }, [filters.search, filters.clientId, filters.dateRange, filters.startDate, filters.endDate]);

  const activeFilters = useMemo(() => {
    const list: { key: string; label: string; value: string; displayValue?: string }[] = [];
    if (filters.search) list.push({ key: 'search', label: 'Search', value: filters.search });
    if (filters.clientId) {
      const c = clients.find((client) => client.id === filters.clientId);
      list.push({ key: 'clientId', label: 'Client', value: filters.clientId, displayValue: c?.companyName });
    }
    if (filters.dateRange) {
      const presetLabels: Record<string, string> = {
        today: 'Today',
        yesterday: 'Yesterday',
        thisWeek: 'This Week',
        thisMonth: 'This Month',
        thisQuarter: 'This Quarter',
        thisYear: 'This Year',
        custom: 'Custom Range',
      };
      list.push({
        key: 'dateRange',
        label: 'Timeline',
        value: presetLabels[filters.dateRange] || filters.dateRange,
      });
    } else if (filters.startDate || filters.endDate) {
      list.push({
        key: 'reportDate',
        label: 'Date Range',
        value: `${filters.startDate || ''} to ${filters.endDate || ''}`,
      });
    }
    return list;
  }, [filters, clients]);

  const handleRemoveActiveFilter = (key: string) => {
    if (key === 'dateRange' || key === 'reportDate') {
      setFilters({ dateRange: '', startDate: '', endDate: '' });
    } else {
      clearFilter(key);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Client Reports"
        description="Track your submitted client work logs, deliverables, and proof of work."
        actions={
          <Link to="/employee/daily-report">
            <Button size="sm" className="flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> New Client Report
            </Button>
          </Link>
        }
      />

      {/* Unified Filter Toolbar */}
      <FilterToolbar
        dateFilter={
          <DateQuickFilter
            selectedPreset={filters.dateRange}
            startDate={filters.startDate}
            endDate={filters.endDate}
            onChange={(preset, start, end) => {
              setFilters({
                dateRange: preset,
                startDate: start || '',
                endDate: end || '',
              });
            }}
          />
        }
        totalResults={reports.length}
        resultsLabel="client reports"
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveActiveFilter}
        onClearAllFilters={clearAllFilters}
      >
        <SearchInput
          placeholder="Search work summaries & tasks..."
          value={filters.search}
          onChange={(val) => setFilter('search', val)}
          className="w-full sm:w-60"
        />

        <FilterSelect
          label="Client"
          value={filters.clientId}
          onChange={(val) => setFilter('clientId', val)}
          options={clients.map((c) => ({ label: c.companyName, value: c.id }))}
        />
      </FilterToolbar>

      {isLoading ? (
        <LoadingState message="Loading your submitted client reports..." />
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No client work reports found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            {activeFiltersCount > 0
              ? 'No reports match your active filters. Try clearing specific filters or resetting.'
              : 'You have not submitted any client work reports yet.'}
          </p>
          {activeFiltersCount > 0 ? (
            <Button variant="outline" size="sm" onClick={clearAllFilters}>
              Reset All Filters
            </Button>
          ) : (
            <Link to="/employee/daily-report">
              <Button size="sm" className="inline-flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Submit Client Report
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-100 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-5">Submission Time</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Service & Task</th>
                  <th className="py-3 px-4">Work Completed</th>
                  <th className="py-3 px-4">Quantity</th>
                  <th className="py-3 px-4">Hours</th>
                  <th className="py-3 px-4">Proof</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((report) => {
                  const isHighlighted = report.id === (selectedReport?.id || reportIdParam);
                  const attachmentCount = report.attachments?.length || 0;
                  return (
                    <tr
                      key={report.id}
                      className={`transition-colors ${
                        isHighlighted
                          ? 'bg-purple-50/80 ring-1 ring-purple-300 ring-inset'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-slate-900">
                          {formatDateTime(report.createdAt || report.reportDate)}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Log Date: {formatDate(report.reportDate)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-purple-700">
                        {report.client?.companyName || 'Unknown Client'}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700">
                        <p className="font-medium text-slate-900">
                          {report.service?.name || 'General Service'}
                        </p>
                        {report.task?.title && (
                          <p className="text-[10px] text-slate-500 truncate max-w-xs">
                            Task: {report.task.title}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-800 font-medium">
                        {report.workCompleted}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700">
                        {report.quantity !== undefined && report.quantity !== null && Number(report.quantity) > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            {Number(report.quantity)} {report.unit || 'units'}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {Number(report.hoursSpent) > 0 ? `${report.hoursSpent} hrs` : '—'}
                      </td>

                      <td className="py-3.5 px-4">
                        {attachmentCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                            <Paperclip className="w-3 h-3" /> {attachmentCount} file{attachmentCount === 1 ? '' : 's'}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedReport(report)}
                          className="text-xs"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> View Details
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Inspect Client Work Report Modal */}
      {selectedReport && (
        <Modal
          isOpen={Boolean(selectedReport)}
          onClose={handleCloseModal}
          title={`Client Work Report — ${selectedReport.client?.companyName || 'Details'}`}
          description={`Submitted on ${formatDateTime(selectedReport.createdAt || selectedReport.reportDate)}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            {/* Meta Summary Cards */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Client</span>
                <span className="font-bold text-purple-700 truncate block">
                  {selectedReport.client?.companyName || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Service</span>
                <span className="font-bold text-slate-900 truncate block">
                  {selectedReport.service?.name || 'General Work'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Quantity</span>
                <span className="font-bold text-slate-900 block">
                  {selectedReport.quantity !== undefined && selectedReport.quantity !== null && Number(selectedReport.quantity) > 0
                    ? `${Number(selectedReport.quantity)} ${selectedReport.unit || 'units'}`
                    : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Hours Logged</span>
                <span className="font-bold text-slate-900 block">
                  {Number(selectedReport.hoursSpent) > 0 ? `${selectedReport.hoursSpent} hrs` : '—'}
                </span>
              </div>
            </div>

            {selectedReport.task && (
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                  <div>
                    <span className="text-[10px] text-indigo-600 uppercase font-bold block">Linked Task</span>
                    <span className="font-semibold text-slate-900">{selectedReport.task.title}</span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                Work Completed (Summary)
              </h4>
              <p className="text-xs text-slate-800 leading-relaxed bg-white p-3 rounded-lg border border-slate-200 font-medium whitespace-pre-line">
                {selectedReport.workCompleted}
              </p>
            </div>

            {selectedReport.workDescription && (
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                  Detailed Description & Context
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/70 p-3 rounded-lg border border-slate-200 whitespace-pre-line">
                  {selectedReport.workDescription}
                </p>
              </div>
            )}

            {selectedReport.workPending && (
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                  Pending Work & Next Steps
                </h4>
                <p className="text-xs text-slate-700 bg-amber-50/50 p-3 rounded-lg border border-amber-200/60 whitespace-pre-line">
                  {selectedReport.workPending}
                </p>
              </div>
            )}

            {/* Attachments / Proof of Work */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-slate-500" /> Proof of Work & Attachments ({selectedReport.attachments?.length || 0})
              </h4>
              {!selectedReport.attachments || selectedReport.attachments.length === 0 ? (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-400 text-center italic">
                  No proof of work files attached to this report.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {selectedReport.attachments.map((att: any) => (
                    <div
                      key={att.id}
                      className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-purple-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{att.fileName}</p>
                          <p className="text-[10px] text-slate-400">
                            {att.fileSize ? `${Math.round(att.fileSize / 1024)} KB` : ''} • {formatDateTime(att.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={att.fileUrl || `/api/daily-reports/daily/${selectedReport.id}/attachments/${att.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 text-[11px] font-semibold text-purple-700 hover:text-purple-900 hover:bg-purple-50 rounded-md border border-purple-200 transition-colors inline-flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" /> Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={handleCloseModal}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
