import React, { useState, useEffect, useMemo } from 'react';
import { dailyReportService, clientService } from '../../services';
import { DailyReport, Client } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { FileText, Plus, Eye, MessageSquare } from 'lucide-react';
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
      status: '',
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
        status: filters.status || undefined,
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
  }, [filters.search, filters.status, filters.clientId, filters.dateRange, filters.startDate, filters.endDate]);

  const activeFilters = useMemo(() => {
    const list: { key: string; label: string; value: string; displayValue?: string }[] = [];
    if (filters.search) list.push({ key: 'search', label: 'Search', value: filters.search });
    if (filters.clientId) {
      const c = clients.find((client) => client.id === filters.clientId);
      list.push({ key: 'clientId', label: 'Client', value: filters.clientId, displayValue: c?.companyName });
    }
    if (filters.status) list.push({ key: 'status', label: 'Status', value: filters.status });
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
        title="My Daily Reports History"
        description="Track your daily work logs, reviewer approvals, and Admin feedback."
        actions={
          <Link to="/employee/daily-report">
            <Button size="sm" className="flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> New Daily Report
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
        resultsLabel="reports"
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveActiveFilter}
        onClearAllFilters={clearAllFilters}
      >
        <SearchInput
          placeholder="Search deliverables & summaries..."
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

        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(val) => setFilter('status', val)}
          options={[
            { label: 'Submitted (Pending Review)', value: 'SUBMITTED' },
            { label: 'Approved', value: 'APPROVED' },
            { label: 'Revision Requested', value: 'REVISION_REQUESTED' },
            { label: 'Draft', value: 'DRAFT' },
          ]}
        />
      </FilterToolbar>

      {isLoading ? (
        <LoadingState message="Loading your submitted reports..." />
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No daily reports found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            {activeFiltersCount > 0
              ? 'No reports match your active filters. Try clearing specific filters or resetting.'
              : 'You have not submitted any daily reports yet.'}
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
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Work Done</th>
                  <th className="py-3 px-4">Hours</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Reviewer Feedback</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((report) => {
                  const isHighlighted = report.id === (selectedReport?.id || reportIdParam);
                  return (
                    <tr
                      key={report.id}
                      className={`transition-colors ${
                        isHighlighted
                          ? 'bg-purple-50/80 ring-1 ring-purple-300 ring-inset'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3.5 px-5 font-bold text-slate-900">{formatDate(report.reportDate)}</td>
                      <td className="py-3.5 px-4 font-semibold text-purple-700">{report.client?.companyName}</td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-700">{report.workCompleted}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{report.hoursSpent} hrs</td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={report.status} />
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-500 italic">
                        {report.reviewerComments || 'No feedback notes yet'}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedReport(report)}
                          className="text-xs"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> View
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

      {/* Inspect Report Modal */}
      {selectedReport && (
        <Modal
          isOpen={Boolean(selectedReport)}
          onClose={handleCloseModal}
          title={`Daily Work Report — ${formatDate(selectedReport.reportDate)}`}
          description={`Client: ${selectedReport.client?.companyName} • Status: ${selectedReport.status}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Hours Logged:</span>
                <span className="font-bold text-slate-900">{selectedReport.hoursSpent} hrs</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Review Status:</span>
                <StatusBadge status={selectedReport.status} />
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                Deliverables Completed
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-line">
                {selectedReport.workCompleted}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                Work Scope & Description
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-line">
                {selectedReport.workDescription}
              </p>
            </div>

            {selectedReport.reviewerComments && (
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs">
                <span className="font-bold text-purple-900 flex items-center gap-1.5 mb-1">
                  <MessageSquare className="w-3.5 h-3.5" /> Reviewer Feedback from Admin
                </span>
                <p className="text-purple-800 leading-relaxed">{selectedReport.reviewerComments}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

