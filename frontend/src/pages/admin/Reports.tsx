import React, { useState, useEffect } from 'react';
import { reportService } from '../../services';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { DateQuickFilter, FilterToolbar } from '../../components/filters';
import { useSmartFilters } from '../../hooks/useSmartFilters';
import { formatINR } from '../../utils/formatters';
import { FileSpreadsheet, FileText, Printer, FileBarChart, ChevronDown, ChevronUp, Layers, CheckCircle2, Info } from 'lucide-react';

export const Reports: React.FC = () => {
  const [reportType, setReportType] = useState('client-delivery');
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);

  const { filters, setFilters } = useSmartFilters({
    dateRange: '',
    startDate: '',
    endDate: '',
  });

  const reportTypes = [
    { id: 'client-delivery', label: '1. Client Delivery Report' },
    { id: 'employee-work', label: '2. Employee Daily Work Report' },
    { id: 'employee-productivity', label: '3. Employee Productivity Summary' },
    { id: 'service-performance', label: '4. Service Performance Report' },
    { id: 'pending-tasks', label: '5. Pending Tasks Report' },
    { id: 'overdue-tasks', label: '6. Overdue Tasks Report' },
    { id: 'revenue', label: '7. Revenue & Collection Report' },
    { id: 'renewals', label: '8. Client Renewal Pipeline Report' },
  ];

  const fetchReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = {
        dateRange: filters.dateRange || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      };

      let res;
      if (reportType === 'client-delivery') {
        res = await reportService.getClientDelivery(queryParams);
      } else if (reportType === 'employee-work') {
        res = await reportService.getEmployeeWork(queryParams);
      } else if (reportType === 'employee-productivity') {
        res = await reportService.getEmployeeProductivity(queryParams);
      } else if (reportType === 'service-performance') {
        res = await reportService.getServicePerformance(queryParams);
      } else if (reportType === 'pending-tasks') {
        res = await reportService.getTasksReport('pending', queryParams);
      } else if (reportType === 'overdue-tasks') {
        res = await reportService.getTasksReport('overdue', queryParams);
      } else if (reportType === 'revenue') {
        res = await reportService.getRevenueReport(queryParams);
      } else if (reportType === 'renewals') {
        res = await reportService.getRenewalsReport(queryParams);
      }
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate report from database');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, filters.dateRange, filters.startDate, filters.endDate]);

  const activeParams = {
    dateRange: filters.dateRange || undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
  };

  const handleDownloadExcel = () => {
    window.open(reportService.getExportExcelUrl(reportType, activeParams), '_blank');
  };

  const handleDownloadPDF = () => {
    window.open(reportService.getExportPDFUrl(reportType, activeParams), '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const isDataEmpty =
    !data ||
    (Array.isArray(data) && data.length === 0) ||
    (reportType === 'revenue' && data?.invoices?.length === 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Reports & Data Exports"
        description="Generate audit-ready PDF & Excel performance reports derived directly from live database records."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadExcel}
              disabled={isDataEmpty}
              className="flex items-center gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" /> Export Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              disabled={isDataEmpty}
              className="flex items-center gap-1.5 text-rose-700 border-rose-300 hover:bg-rose-50 disabled:opacity-50"
            >
              <FileText className="w-4 h-4" /> Download PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="flex items-center gap-1.5">
              <Printer className="w-4 h-4" /> Print
            </Button>
          </div>
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
      />

      {/* Report Type Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        {reportTypes.map((t) => (
          <button
            key={t.id}
            onClick={() => setReportType(t.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              reportType === t.id
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingState message="Compiling report data from database..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchReport} />
      ) : isDataEmpty ? (
        <EmptyState
          icon={FileBarChart}
          title="No records found for this report"
          description="This report will populate automatically as relevant clients, tasks, daily reports, and invoices are recorded in the system."
        />
      ) : (
        <Card className="p-0 overflow-hidden shadow-xs border border-slate-200/80">
          {/* 1. CLIENT DELIVERY REPORT */}
          {reportType === 'client-delivery' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold z-10">
                  <tr>
                    <th className="py-3 px-5 text-left">Client</th>
                    <th className="py-3 px-4 text-left">Package</th>
                    <th className="py-3 px-4 text-left">Status</th>
                    <th className="py-3 px-4 text-right">Delivery Progress</th>
                    <th className="py-3 px-4 text-right">Target Deliverables</th>
                    <th className="py-3 px-4 text-right">Completed Deliverables</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.map((c: any) => {
                    const isExpanded = expandedServiceId === c.clientId;
                    return (
                      <React.Fragment key={c.clientId}>
                        <tr
                          onClick={() => setExpandedServiceId(isExpanded ? null : c.clientId)}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer border-b border-slate-100"
                        >
                          <td className="py-3.5 px-5 font-bold text-slate-900 flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-purple-600 shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <div>
                              <span>{c.companyName}</span>
                              <span className="block text-[10px] font-normal text-slate-400">
                                Click to view {c.services?.length || 0} service breakdown(s)
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-purple-700 font-medium">{c.packageName}</td>
                          <td className="py-3.5 px-4 font-semibold">{c.status}</td>
                          <td className="py-3.5 px-4 text-right">
                            <span className="font-extrabold text-slate-900 block">{c.overallDeliveryProgress}%</span>
                            <div className="w-20 bg-slate-100 rounded-full h-1.5 ml-auto mt-1 overflow-hidden">
                              <div
                                className="bg-purple-600 h-1.5 rounded-full"
                                style={{ width: `${c.overallDeliveryProgress}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-700">{c.totalDeliverablesTarget}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                            {c.totalDeliverablesCompleted}
                          </td>
                        </tr>

                        {/* Expanded Service & Deliverable Item Breakdown */}
                        {isExpanded && (
                          <tr className="bg-slate-50/70">
                            <td colSpan={6} className="p-4">
                              <div className="space-y-3 bg-white p-4 rounded-xl border border-purple-100 shadow-2xs">
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                  <Layers className="w-4 h-4 text-purple-600" />
                                  Agreed Deliverables Breakdown — {c.companyName}
                                </h4>

                                {c.services && c.services.length > 0 ? (
                                  <div className="space-y-3">
                                    {c.services.map((svc: any, idx: number) => (
                                      <div
                                        key={idx}
                                        className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50 space-y-2 text-xs"
                                      >
                                        <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-200/60">
                                          <div>
                                            <span className="font-bold text-slate-900">{svc.serviceName}</span>
                                            <span className="text-[11px] text-slate-500 ml-2">
                                              Team: <strong className="text-slate-700">{svc.assignedTo}</strong>
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="font-mono text-slate-600">
                                              {svc.completed} / {svc.target} units completed
                                            </span>
                                            <span className="font-bold text-purple-700 px-2 py-0.5 rounded bg-purple-100 text-[11px]">
                                              {svc.completionPercentage}%
                                            </span>
                                          </div>
                                        </div>

                                        {/* Deliverable Items List */}
                                        {svc.deliverablesBreakdown && svc.deliverablesBreakdown.length > 0 ? (
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                            {svc.deliverablesBreakdown.map((item: any) => (
                                              <div
                                                key={item.id}
                                                className="p-2.5 bg-white rounded border border-slate-200 text-xs flex flex-col justify-between gap-1.5"
                                              >
                                                <div className="flex items-start justify-between gap-2">
                                                  <span className="font-semibold text-slate-800 leading-tight">
                                                    {item.name}
                                                  </span>
                                                  <span
                                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                                      item.statusText === 'COMPLETED'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : item.statusText === 'IN_PROGRESS'
                                                        ? 'bg-purple-100 text-purple-800'
                                                        : 'bg-slate-100 text-slate-600'
                                                    }`}
                                                  >
                                                    {item.statusText}
                                                  </span>
                                                </div>
                                                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                                                  <span>
                                                    Approved: <strong>{item.approvedQuantity}</strong> / {item.targetQuantity} {item.unit}
                                                  </span>
                                                  <span className="font-bold text-slate-900">{item.progressPercent}%</span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                                                  <div
                                                    className={`h-1 rounded-full ${
                                                      item.progressPercent >= 100
                                                        ? 'bg-emerald-500'
                                                        : 'bg-purple-600'
                                                    }`}
                                                    style={{ width: `${item.progressPercent}%` }}
                                                  />
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-[11px] text-slate-400 italic">
                                            Deliverables: {svc.agreedDeliverables}
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400">No services configured for this client.</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                </tbody>
              </table>
            </div>
          )}

          {/* 2. EMPLOYEE DAILY WORK REPORT */}
          {reportType === 'employee-work' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold z-10">
                  <tr>
                    <th className="py-3 px-5 text-left">Date</th>
                    <th className="py-3 px-4 text-left">Employee</th>
                    <th className="py-3 px-4 text-left">Client</th>
                    <th className="py-3 px-4 text-left">Service / Task</th>
                    <th className="py-3 px-4 text-right">Hours Logged</th>
                    <th className="py-3 px-4 text-left">Work Completed</th>
                    <th className="py-3 px-4 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-slate-600">{r.date}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{r.employeeName}</td>
                      <td className="py-3.5 px-4 text-slate-700">{r.clientName}</td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <span className="font-medium text-slate-800">{r.serviceName}</span>
                        {r.taskTitle && r.taskTitle !== '-' && (
                          <span className="block text-[11px] text-slate-500">{r.taskTitle}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900">
                        {r.hoursSpent} hrs
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={r.workCompleted}>
                        {r.workCompleted}
                      </td>
                      <td className="py-3.5 px-4 font-semibold">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            r.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : r.status === 'REVISION_REQUESTED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 3. EMPLOYEE PRODUCTIVITY SUMMARY */}
          {reportType === 'employee-productivity' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold z-10">
                  <tr>
                    <th className="py-3 px-5 text-left">Employee ID</th>
                    <th className="py-3 px-4 text-left">Full Name</th>
                    <th className="py-3 px-4 text-left">Designation</th>
                    <th className="py-3 px-4 text-right">Assigned Tasks</th>
                    <th className="py-3 px-4 text-right">Completed Tasks</th>
                    <th className="py-3 px-4 text-right">Pending Tasks</th>
                    <th className="py-3 px-4 text-right">Overdue Tasks</th>
                    <th className="py-3 px-4 text-right">Completion Rate</th>
                    <th className="py-3 px-4 text-right">Logged Work Hours</th>
                    <th className="py-3 px-4 text-right">Reports Approved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.map((e: any) => (
                    <tr key={e.employeeId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-5 font-mono font-bold text-slate-700">{e.employeeId}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{e.fullName}</td>
                      <td className="py-3.5 px-4 text-slate-500">{e.designation}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                        {e.totalTasksAssigned ?? 0}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                        {e.completedTasks ?? e.totalTasksCompleted ?? 0}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-amber-600">
                        {e.pendingTasks ?? 0}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-600">
                        {e.overdueTasks ?? 0}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            (e.taskCompletionRate ?? 0) >= 80
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : (e.taskCompletionRate ?? 0) >= 50
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {e.taskCompletionRate ?? 0}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900">
                        {e.totalWorkHoursLogged ?? e.totalLoggedHours ?? 0} hrs
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-blue-700">
                        {e.reportsApproved ?? e.approvedReportsCount ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 4. SERVICE PERFORMANCE REPORT */}
          {reportType === 'service-performance' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold z-10">
                  <tr>
                    <th className="py-3 px-5 text-left">Service Name</th>
                    <th className="py-3 px-4 text-right">Active Clients</th>
                    <th className="py-3 px-4 text-right">Tasks Created</th>
                    <th className="py-3 px-4 text-right">Tasks Completed</th>
                    <th className="py-3 px-4 text-right">Task Completion %</th>
                    <th className="py-3 px-4 text-left">Agreed Deliverables Scope</th>
                    <th className="py-3 px-4 text-center">Target Period</th>
                    <th className="py-3 px-4 text-right">Approved Deliverable Progress</th>
                    <th className="py-3 px-4 text-center">Breakdown</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.map((s: any) => {
                    const isExpanded = expandedServiceId === s.serviceId;
                    const items = s.deliverablesBreakdown || [];

                    return (
                      <React.Fragment key={s.serviceId}>
                        <tr className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-5 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <Layers className="w-4 h-4 text-purple-600 shrink-0" />
                              <span>{s.serviceName}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <span className="font-bold font-mono text-slate-900 text-sm">
                              {s.activeClients ?? 0}
                            </span>
                            {s.onboardingClients > 0 && (
                              <span className="block text-[10px] text-purple-700 font-semibold">
                                {s.onboardingClients} Onboarding
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-700">
                            {s.tasksCreated ?? 0}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                            {s.tasksCompleted ?? 0}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                (s.taskCompletionRate ?? 0) >= 80
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : (s.taskCompletionRate ?? 0) >= 50
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {s.taskCompletionRate ?? 0}%
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-slate-700 max-w-xs">
                            <span
                              className="font-medium text-slate-900 block truncate"
                              title={s.agreedDeliverables}
                            >
                              {s.agreedDeliverables || `${s.totalMonthlyTarget || 0} units`}
                            </span>
                            {items.length > 0 && (
                              <span className="text-[10px] text-slate-500 mt-0.5 block">
                                {items.length} agreed deliverable items
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                              {s.targetPeriod || 'MONTHLY'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-purple-600 rounded-full transition-all"
                                  style={{
                                    width: `${s.approvedDeliverableProgress ?? s.deliveryProgress ?? 0}%`,
                                  }}
                                />
                              </div>
                              <span className="font-bold text-purple-700 font-mono text-xs">
                                {s.approvedDeliverableProgress ?? s.deliveryProgress ?? 0}%
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 block">
                              {s.completedDeliverables ?? 0} approved units
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {items.length > 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedServiceId(isExpanded ? null : s.serviceId)
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-purple-700 hover:bg-purple-50 border border-purple-200 transition-colors"
                              >
                                {isExpanded ? (
                                  <>
                                    Hide <ChevronUp className="w-3 h-3" />
                                  </>
                                ) : (
                                  <>
                                    Items <ChevronDown className="w-3 h-3" />
                                  </>
                                )}
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">—</span>
                            )}
                          </td>
                        </tr>

                        {/* Nested Deliverables Breakdown */}
                        {isExpanded && items.length > 0 && (
                          <tr className="bg-purple-50/30 border-b border-purple-100">
                            <td colSpan={9} className="p-4">
                              <div className="bg-white rounded-xl border border-purple-100 p-4 shadow-xs space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-purple-600" />
                                    <span className="text-xs font-bold text-slate-900">
                                      Agreed Deliverables Breakdown — {s.serviceName}
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-slate-500">
                                    Calculated via item-by-item completion formula (Equal-weighted)
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {items.map((item: any) => (
                                    <div
                                      key={item.id}
                                      className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 flex flex-col justify-between gap-2"
                                    >
                                      <div>
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="font-semibold text-slate-900 text-xs">
                                            {item.name}
                                          </span>
                                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700">
                                            {item.deliverableType}
                                          </span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 block mt-0.5">
                                          Period: {item.targetPeriod}
                                        </span>
                                      </div>

                                      <div>
                                        <div className="flex items-center justify-between text-xs mb-1">
                                          <span className="font-medium text-slate-600">
                                            {item.deliverableType === 'FEATURE'
                                              ? item.statusText === 'COMPLETED'
                                                ? 'Approved'
                                                : item.statusText === 'IN_PROGRESS'
                                                ? 'In Progress'
                                                : 'Not Started'
                                              : `${item.approvedQuantity} / ${item.targetQuantity} ${item.unit || 'units'}`}
                                          </span>
                                          <span className="font-bold font-mono text-purple-700">
                                            {item.progressPercent}%
                                          </span>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-purple-600 rounded-full transition-all"
                                            style={{ width: `${item.progressPercent}%` }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 5 & 6. TASKS REPORT (PENDING & OVERDUE) */}
          {(reportType === 'pending-tasks' || reportType === 'overdue-tasks') && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold z-10">
                  <tr>
                    <th className="py-3 px-5 text-left">Task Title</th>
                    <th className="py-3 px-4 text-left">Client</th>
                    <th className="py-3 px-4 text-left">Assigned Staff</th>
                    <th className="py-3 px-4 text-left">Priority</th>
                    <th className="py-3 px-4 text-left">Due Date</th>
                    <th className="py-3 px-4 text-right">Progress</th>
                    <th className="py-3 px-4 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.map((t: any) => (
                    <tr key={t.taskId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-slate-900">{t.title}</td>
                      <td className="py-3.5 px-4 text-slate-600">{t.clientName}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">{t.assignedTo}</td>
                      <td className="py-3.5 px-4 font-bold">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            t.priority === 'URGENT'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : t.priority === 'HIGH'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono">{t.dueDate}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-purple-700">
                        {t.completionPercentage}%
                      </td>
                      <td className="py-3.5 px-4 font-semibold">{t.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 7. REVENUE & COLLECTION REPORT */}
          {reportType === 'revenue' && (
            <div>
              <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Total Invoiced</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                    {formatINR(data?.summary?.totalInvoiced || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Total Received Money</p>
                  <p className="text-sm font-extrabold text-emerald-600 mt-0.5">
                    {formatINR(data?.summary?.totalReceivedMoney ?? data?.summary?.totalCollected ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Pending Balance</p>
                  <p className="text-sm font-extrabold text-amber-600 mt-0.5">
                    {formatINR(data?.summary?.totalPending || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Overdue Receivables</p>
                  <p className="text-sm font-extrabold text-rose-600 mt-0.5">
                    {formatINR(data?.summary?.totalOverdue || 0)}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold z-10">
                    <tr>
                      <th className="py-3 px-5 text-left">Invoice #</th>
                      <th className="py-3 px-4 text-left">Client</th>
                      <th className="py-3 px-4 text-left">Date</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-right">Paid</th>
                      <th className="py-3 px-4 text-right">Balance</th>
                      <th className="py-3 px-4 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data?.invoices?.map((inv: any) => (
                      <tr key={inv.invoiceNumber} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-5 font-mono font-bold text-purple-700">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{inv.clientName}</td>
                        <td className="py-3.5 px-4 text-slate-500 font-mono">{inv.invoiceDate}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold">{formatINR(inv.amount)}</td>
                        <td className="py-3.5 px-4 text-right font-mono text-emerald-600 font-semibold">
                          {formatINR(inv.amountPaid)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-amber-600">
                          {formatINR(inv.remainingBalance)}
                        </td>
                        <td className="py-3.5 px-4 font-semibold">{inv.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 8. RENEWALS REPORT */}
          {reportType === 'renewals' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold z-10">
                  <tr>
                    <th className="py-3 px-5 text-left">Client</th>
                    <th className="py-3 px-4 text-left">Contact</th>
                    <th className="py-3 px-4 text-left">Package</th>
                    <th className="py-3 px-4 text-left">Renewal Date</th>
                    <th className="py-3 px-4 text-right">Days Left</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.map((r: any) => (
                    <tr key={r.renewalId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-slate-900">{r.clientName}</td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {r.contactPerson} ({r.contactPhone})
                      </td>
                      <td className="py-3.5 px-4 text-purple-700 font-medium">{r.packageName}</td>
                      <td className="py-3.5 px-4 font-mono">{r.renewalDate}</td>
                      <td
                        className={`py-3.5 px-4 text-right font-bold ${
                          r.daysLeft <= 7 ? 'text-rose-600' : 'text-slate-900'
                        }`}
                      >
                        {r.daysLeft} days
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold">{formatINR(r.renewalAmount)}</td>
                      <td className="py-3.5 px-4 font-semibold">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
