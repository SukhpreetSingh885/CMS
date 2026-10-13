import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { dailyReportService, userService, clientService } from '../../services';
import { DailyReport, User, Client } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Input';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { FileText, CheckCircle2, RotateCcw, Clock, Eye, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useSmartFilters } from '../../hooks/useSmartFilters';
import {
  FilterToolbar,
  SearchInput,
  FilterSelect,
  DateQuickFilter,
  FilterDrawer,
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
      status: '',
      dateRange: '',
      startDate: '',
      endDate: '',
      isSelfReviewed: '',
    });

  const [reports, setReports] = useState<DailyReport[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Review Modal State
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVED' | 'REVISION_REQUESTED' | null>(null);
  const [reviewerFeedback, setReviewerFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const res = await dailyReportService.listReports({
        search: filters.search || undefined,
        submittedById: filters.submittedById || undefined,
        clientId: filters.clientId || undefined,
        serviceId: filters.serviceId || undefined,
        status: filters.status || undefined,
        dateRange: (filters.dateRange as any) || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        isSelfReviewed: filters.isSelfReviewed || undefined,
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
    filters.status,
    filters.dateRange,
    filters.startDate,
    filters.endDate,
    filters.isSelfReviewed,
  ]);

  // Deep-linking: automatically open report modal when ?reportId=... is provided
  useEffect(() => {
    if (!reportIdParam) return;

    // Check if report already exists in current reports list
    const found = reports.find((r) => r.id === reportIdParam);
    if (found) {
      setSelectedReport(found);
      setReviewerFeedback(found.reviewerComments || '');
      return;
    }

    // Fetch report directly by ID if not present in the currently loaded page/filter
    let isSubscribed = true;
    dailyReportService
      .getReportById(reportIdParam)
      .then((rep) => {
        if (isSubscribed && rep) {
          setSelectedReport(rep);
          setReviewerFeedback(rep.reviewerComments || '');
        }
      })
      .catch(() => {
        // Handled silently
      });

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
    if (filters.status) list.push({ key: 'status', label: 'Status', value: filters.status });
    if (filters.isSelfReviewed === 'true') {
      list.push({ key: 'isSelfReviewed', label: 'Review', value: 'Self Reviewed' });
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
    setReviewAction(null);
    setReviewerFeedback('');
    if (searchParams.get('reportId')) {
      searchParams.delete('reportId');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const handleReviewSubmit = async (status: 'APPROVED' | 'REVISION_REQUESTED') => {
    if (!selectedReport) return;
    setIsSubmitting(true);
    try {
      await dailyReportService.reviewReport(
        selectedReport.id,
        status,
        reviewerFeedback || (status === 'APPROVED' ? 'Approved by Admin.' : 'Please revise requested items.')
      );
      toast.success(`Report marked as ${status.replace('_', ' ')}`);
      handleCloseModal();
      loadReports();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Work Reports"
        description="Review daily work submissions from creative, performance, and video team members."
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
        onOpenAdvanced={() => setIsAdvancedOpen(true)}
        advancedCount={
          [filters.isSelfReviewed].filter(Boolean).length
        }
        advancedLabel="Advanced Filters"
      >
        <SearchInput
          placeholder="Search work descriptions or tasks..."
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

      {/* Advanced Filter Drawer */}
      <FilterDrawer
        isOpen={isAdvancedOpen}
        onClose={() => setIsAdvancedOpen(false)}
        title="Advanced Report Filters"
        onApply={() => setIsAdvancedOpen(false)}
        onReset={() => {
          clearAllFilters();
          setIsAdvancedOpen(false);
        }}
        activeFiltersCount={activeFiltersCount}
      >
        <div className="space-y-4">
          <FilterSelect
            label="Self-Review Filter"
            value={filters.isSelfReviewed}
            onChange={(val) => setFilter('isSelfReviewed', val)}
            options={[
              { label: 'Self Reviewed by Author', value: 'true' },
              { label: 'Reviewed by Others', value: 'false' },
            ]}
          />
        </div>
      </FilterDrawer>

      {isLoading ? (
        <LoadingState message="Loading daily reports..." />
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No daily reports match your filter criteria</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Try adjusting your search terms, changing the author or date range, or resetting filters.
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
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Work Summary</th>
                  <th className="py-3 px-4">Hours</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Review Action</th>
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
                      <td className="py-3.5 px-5 font-semibold text-slate-900">
                        {formatDate(report.reportDate)}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {report.submittedBy?.fullName}
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {report.submittedBy?.designation}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-purple-700 font-semibold">
                        {report.client?.companyName}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="font-medium text-slate-800 line-clamp-1">{report.workCompleted}</p>
                        <p className="text-[10px] text-slate-500 line-clamp-1">{report.workDescription}</p>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {report.hoursSpent} hrs
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusBadge status={report.status} />
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <Button
                          size="sm"
                          variant={report.status === 'SUBMITTED' ? 'primary' : 'outline'}
                          onClick={() => {
                            setSelectedReport(report);
                            setReviewerFeedback(report.reviewerComments || '');
                          }}
                          className="text-xs"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          {report.status === 'SUBMITTED' ? 'Review & Feedback' : 'View Details'}
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

      {/* Daily Report Detail & Review Modal */}
      {selectedReport && (
        <Modal
          isOpen={Boolean(selectedReport)}
          onClose={handleCloseModal}
          title={`Daily Work Report — ${formatDate(selectedReport.reportDate)}`}
          description={`Author: ${selectedReport.submittedBy?.fullName} • Client: ${selectedReport.client?.companyName}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Hours Logged:</span>
                <span className="font-bold text-slate-900">{selectedReport.hoursSpent} hours</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Current Status:</span>
                <StatusBadge status={selectedReport.status} />
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Task Link:</span>
                <span className="font-semibold text-purple-700">{selectedReport.task?.title || 'Direct Work'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Service:</span>
                <span className="font-semibold text-slate-800">{selectedReport.service?.name || '-'}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                Work Completed
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-line">
                {selectedReport.workCompleted}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                Scope & Description
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-line">
                {selectedReport.workDescription}
              </p>
            </div>

            {selectedReport.workPending && (
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                  Pending Next Steps
                </h4>
                <p className="text-xs text-slate-700 bg-amber-50/50 p-3 rounded-lg border border-amber-200/60">
                  {selectedReport.workPending}
                </p>
              </div>
            )}

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

            {selectedReport.nextAction && (
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                  Planned Next Action
                </h4>
                <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {selectedReport.nextAction}
                </p>
              </div>
            )}

            {/* Reviewer Feedback Section */}
            <div className="pt-3 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-900 mb-1.5">
                Admin Feedback & Review Notes
              </label>
              <Textarea
                placeholder="Enter feedback for employee or specific revision instructions..."
                value={reviewerFeedback}
                onChange={(e) => setReviewerFeedback(e.target.value)}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={handleCloseModal}>
                Close
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleReviewSubmit('REVISION_REQUESTED')}
                  isLoading={isSubmitting}
                  className="text-amber-700 border-amber-300 hover:bg-amber-50"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Request Revision
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => handleReviewSubmit('APPROVED')}
                  isLoading={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve Report
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

