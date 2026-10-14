import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { dailyReportService, userService, clientService } from '../../services';
import { DailyReport, User, Client } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/common/LoadingState';
import { formatDate, formatDateTime } from '../../utils/formatters';
import {
  FileText,
  Clock,
  Eye,
  Paperclip,
  Download,
  AlertTriangle,
  CheckSquare,
  Briefcase,
  Layers,
  User as UserIcon,
} from 'lucide-react';
import { useSmartFilters } from '../../hooks/useSmartFilters';
import {
  FilterToolbar,
  SearchInput,
  FilterSelect,
  DateQuickFilter,
} from '../../components/filters';

export const DailyReports: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const reportIdParam = searchParams.get('reportId');

  const { filters, setFilter, setFilters, clearFilter, clearAllFilters, activeFiltersCount } =
    useSmartFilters({
      search: '',
      submittedById: '',
      clientId: '',
      serviceId: '',
      dateRange: '',
      startDate: '',
      endDate: '',
    });

  const [reports, setReports] = useState<DailyReport[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const res = await dailyReportService.listReports({
        search: filters.search || undefined,
        submittedById: filters.submittedById || undefined,
        clientId: filters.clientId || undefined,
        serviceId: filters.serviceId || undefined,
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

  const loadFilterOptions = async () => {
    const [empRes, clientRes] = await Promise.all([
      userService.listEmployees({ pageSize: 100 }),
      clientService.listClients({ pageSize: 100 }),
    ]);
    setEmployees(empRes.data || []);
    setClients(clientRes.data || []);
  };

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadReports();
  }, [
    filters.search,
    filters.submittedById,
    filters.clientId,
    filters.serviceId,
    filters.dateRange,
    filters.startDate,
    filters.endDate,
  ]);

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

  const activeFilters = React.useMemo(() => {
    const list: { key: string; label: string; value: string; displayValue?: string }[] = [];
    if (filters.search) list.push({ key: 'search', label: 'Search', value: filters.search });
    if (filters.submittedById) {
      const emp = employees.find((e) => e.id === filters.submittedById);
      list.push({ key: 'submittedById', label: 'Employee', value: filters.submittedById, displayValue: emp?.fullName });
    }
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
  }, [filters, employees, clients]);

  const handleRemoveActiveFilter = (key: string) => {
    if (key === 'dateRange' || key === 'reportDate') {
      setFilters({ dateRange: '', startDate: '', endDate: '' });
    } else {
      clearFilter(key);
    }
  };

  const handleCloseModal = () => {
    setSelectedReport(null);
    if (searchParams.get('reportId')) {
      searchParams.delete('reportId');
      setSearchParams(searchParams, { replace: true });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Work Reports"
        description="Inspect chronological work submissions, deliverables, quantities, and proof of work across clients and employees."
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
          placeholder="Search deliverables, tasks or notes..."
          value={filters.search}
          onChange={(val) => setFilter('search', val)}
          className="w-full sm:w-60"
        />

        <FilterSelect
          label="Team Member"
          value={filters.submittedById}
          onChange={(val) => setFilter('submittedById', val)}
          options={employees.map((e) => ({ label: `${e.fullName} (${e.designation || 'Staff'})`, value: e.id }))}
        />

        <FilterSelect
          label="Client"
          value={filters.clientId}
          onChange={(val) => setFilter('clientId', val)}
          options={clients.map((c) => ({ label: c.companyName, value: c.id }))}
        />
      </FilterToolbar>

      {isLoading ? (
        <LoadingState message="Loading client work reports..." />
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No client work reports match your criteria</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Try adjusting your search terms, changing the employee, client, or date range.
          </p>
          {activeFiltersCount > 0 && (
            <Button variant="outline" size="sm" onClick={clearAllFilters}>
              Reset All Filters
            </Button>
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
                  <th className="py-3 px-4">Employee</th>
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
                          Date: {formatDate(report.reportDate)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-purple-700">
                        {report.client?.companyName || 'Unknown Client'}
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">{report.submittedBy?.fullName}</p>
                        <p className="text-[10px] text-slate-400">
                          {report.submittedBy?.designation || 'Staff'}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 text-slate-700">
                        <p className="font-medium text-slate-900">
                          {report.service?.name || 'General Work'}
                        </p>
                        {report.task?.title && (
                          <p className="text-[10px] text-slate-500 truncate max-w-xs">
                            Task: {report.task.title}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="font-medium text-slate-900 truncate">{report.workCompleted}</p>
                        {report.workDescription && (
                          <p className="text-[10px] text-slate-500 truncate">{report.workDescription}</p>
                        )}
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

      {/* Client Work Report Detail Modal (Inspection View - No Approval Pressure) */}
      {selectedReport && (
        <Modal
          isOpen={Boolean(selectedReport)}
          onClose={handleCloseModal}
          title={`Client Work Report — ${selectedReport.client?.companyName || 'Details'}`}
          description={`Submitted by ${selectedReport.submittedBy?.fullName || 'Employee'} on ${formatDateTime(selectedReport.createdAt || selectedReport.reportDate)}`}
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
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Employee</span>
                <span className="font-bold text-slate-900 truncate block">
                  {selectedReport.submittedBy?.fullName || '—'}
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

            {/* Service & Task Link */}
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Service</span>
                <span className="font-semibold text-slate-900">
                  {selectedReport.service?.name || 'General Service Work'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Linked Task</span>
                <span className="font-semibold text-slate-900">
                  {selectedReport.task?.title || 'Direct Client Work (No task link)'}
                </span>
              </div>
            </div>

            {/* Work Completed */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                Work Completed (Summary)
              </h4>
              <p className="text-xs text-slate-900 leading-relaxed bg-white p-3 rounded-lg border border-slate-200 font-medium whitespace-pre-line">
                {selectedReport.workCompleted}
              </p>
            </div>

            {/* Detailed Description */}
            {selectedReport.workDescription && (
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                  Detailed Scope & Description
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/70 p-3 rounded-lg border border-slate-200 whitespace-pre-line">
                  {selectedReport.workDescription}
                </p>
              </div>
            )}

            {/* Pending Work */}
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

            {/* Issues or Blockers */}
            {selectedReport.issuesOrBlockers && (
              <div>
                <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Issues or Blockers
                </h4>
                <p className="text-xs text-rose-900 bg-rose-50/70 p-3 rounded-lg border border-rose-200 whitespace-pre-line">
                  {selectedReport.issuesOrBlockers}
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

            {/* Close Button */}
            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
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
