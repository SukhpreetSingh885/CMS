import React, { useEffect, useState } from 'react';
import {
  Users,
  Briefcase,
  ShieldCheck,
  CheckSquare,
  Clock,
  IndianRupee,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
  TrendingUp,
  FileText,
  Calendar,
} from 'lucide-react';
import { dashboardService } from '../../services';
import { StatCard } from '../../components/common/StatCard';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { DateQuickFilter, FilterToolbar } from '../../components/filters';
import { useSmartFilters } from '../../hooks/useSmartFilters';
import { formatINR, formatDate } from '../../utils/formatters';
import { Link, useNavigate } from 'react-router-dom';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { filters, setFilters } = useSmartFilters({
    dateRange: '',
    startDate: '',
    endDate: '',
  });

  const fetchDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await dashboardService.getAdminDashboard({
        dateRange: filters.dateRange || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch executive dashboard metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const handleUpdate = () => {
      fetchDashboard();
    };
    window.addEventListener('finance-data-updated', handleUpdate);
    return () => {
      window.removeEventListener('finance-data-updated', handleUpdate);
    };
  }, [filters.dateRange, filters.startDate, filters.endDate]);

  if (isLoading && !data) {
    return <LoadingState message="Loading executive dashboard..." />;
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Admin Executive Dashboard"
          description="Real-time company-wide performance metrics, client deliverables, and pending approvals."
        />
        <ErrorState
          message={error || 'Failed to load executive dashboard data. Please verify your connection and try again.'}
          onRetry={fetchDashboard}
        />
      </div>
    );
  }

  const { kpis, sections } = data || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Executive Dashboard"
        description="Real-time company-wide performance metrics, client deliverables, and pending approvals."
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/admin/clients"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 shadow-sm"
            >
              + Onboard Client
            </Link>
            <Link
              to="/admin/tasks"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
            >
              + Assign Task
            </Link>
          </div>
        }
      />

      {/* Date Quick Filter Bar */}
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

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Received Money"
          value={formatINR(kpis?.totalReceivedMoney || 0)}
          subtitle={
            kpis?.filterApplied
              ? `${kpis?.receivedPaymentsCount || 0} payment${kpis?.receivedPaymentsCount === 1 ? '' : 's'} (${formatINR(kpis?.allTimeReceivedMoney || 0)} all-time)`
              : `${kpis?.allTimePaymentsCount || kpis?.receivedPaymentsCount || 0} verified payment transaction${(kpis?.allTimePaymentsCount || kpis?.receivedPaymentsCount) === 1 ? '' : 's'}`
          }
          icon={IndianRupee}
          color="emerald"
          onClick={() => navigate('/admin/payments')}
        />

        <StatCard
          title="Monthly Recurring Revenue"
          value={formatINR(kpis?.monthlyRecurringRevenue ?? kpis?.monthlyRevenue ?? 0)}
          subtitle={
            (kpis as any)?.monthlyOneTimeRevenue > 0
              ? `+ ${formatINR((kpis as any).monthlyOneTimeRevenue)} one-time projects`
              : 'Active monthly retainers'
          }
          icon={TrendingUp}
          color="blue"
          onClick={() => navigate('/admin/invoices')}
        />

        <StatCard
          title="Total Clients"
          value={kpis?.totalClients || 0}
          subtitle={`${kpis?.activeClients || 0} active retainers`}
          icon={Briefcase}
          color="purple"
          onClick={() => navigate('/admin/clients')}
        />

        <StatCard
          title="Total Employees"
          value={kpis?.totalEmployees || 0}
          subtitle="Full-time staff members"
          icon={Users}
          color="slate"
          onClick={() => navigate('/admin/employees')}
        />
      </div>

      {/* Operational Task & Review KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tasks Completed"
          value={kpis?.tasksCompleted || 0}
          subtitle={`${kpis?.tasksAssignedToday || 0} assigned today`}
          icon={CheckSquare}
          color="emerald"
          onClick={() => navigate('/admin/tasks?status=COMPLETED')}
        />

        <StatCard
          title="Pending Tasks"
          value={kpis?.pendingTasks || 0}
          subtitle={`${kpis?.overdueTasks || 0} overdue items`}
          icon={Clock}
          color="amber"
          onClick={() => navigate('/admin/tasks?status=IN_PROGRESS')}
        />

        <StatCard
          title="Pending Approvals"
          value={kpis?.pendingReportApprovals || 0}
          subtitle="Daily reports awaiting review"
          icon={FileText}
          color="purple"
          onClick={() => navigate('/admin/approvals?status=SUBMITTED')}
        />

        <StatCard
          title="Upcoming Renewals"
          value={kpis?.upcomingRenewals || 0}
          subtitle="Due within next 30 days"
          icon={RefreshCw}
          color="amber"
          onClick={() => navigate('/admin/renewals?window=30days')}
        />
      </div>

      {/* Main Grid: Client Delivery Progress & Employee Productivity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Delivery Completion */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Client Delivery Progress</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Monthly deliverable targets completion across client services
                </p>
              </div>
              <Link
                to="/admin/clients"
                className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                View all <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>

            <div className="divide-y divide-slate-100">
              {sections?.clientDeliveryProgress?.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No active clients found.</p>
              ) : (
                sections?.clientDeliveryProgress?.map((c: any) => (
                  <div key={c.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/admin/clients/${c.id}`}
                          className="text-sm font-semibold text-slate-900 hover:text-purple-600 truncate"
                        >
                          {c.companyName}
                        </Link>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {c.packageName} • {c.servicesCount} services assigned
                      </p>
                    </div>

                    <div className="w-40 flex flex-col items-end">
                      <span className="text-xs font-bold text-slate-900">
                        {c.deliveryProgress}% Delivered
                      </span>
                      <div className="w-full bg-slate-100 rounded-full h-2 mt-1 overflow-hidden">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all"
                          style={{ width: `${c.deliveryProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Pending Approvals & Overdue Tasks */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
              <Link
                to="/admin/approvals"
                className="text-xs font-semibold text-purple-600 hover:text-purple-700"
              >
                Review queue
              </Link>
            </CardHeader>

            <div className="space-y-3">
              {sections?.recentDailyReports?.slice(0, 4).map((r: any) => (
                <div
                  key={r.id}
                  className="p-3 bg-slate-50 rounded-lg border border-slate-200/60 flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {r.submittedBy?.fullName}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{r.client?.companyName}</p>
                    <span className="text-[10px] text-slate-400">{formatDate(r.reportDate)}</span>
                  </div>
                  <StatusBadge status={r.status} className="shrink-0" />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-rose-600 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> Overdue Tasks
              </CardTitle>
              <Link
                to="/admin/tasks"
                className="text-xs font-semibold text-purple-600 hover:text-purple-700"
              >
                View all
              </Link>
            </CardHeader>

            <div className="space-y-2.5">
              {sections?.overdueTasks?.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">No overdue tasks! 🎉</p>
              ) : (
                sections?.overdueTasks?.slice(0, 3).map((t: any) => (
                  <div
                    key={t.id}
                    className="p-2.5 bg-rose-50/60 border border-rose-100 rounded-lg flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">{t.title}</p>
                      <p className="text-[10px] text-slate-500">
                        {t.client?.companyName} • Assignee: {t.assignedTo?.fullName}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded shrink-0">
                      Due {formatDate(t.dueDate)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Employee Productivity Overview */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Employee Productivity Overview</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Individual staff performance, completed assignments, on-time task closure rates
            </p>
          </div>
          <Link
            to="/admin/employees"
            className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1"
          >
            Manage Employees <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-y border-slate-100 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Designation</th>
                <th className="py-3 px-4">Total Tasks</th>
                <th className="py-3 px-4">Completed</th>
                <th className="py-3 px-4">Pending</th>
                <th className="py-3 px-4">Overdue</th>
                <th className="py-3 px-4">Completion Rate</th>
                <th className="py-3 px-4">Hours Logged</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sections?.employeeProductivity?.map((emp: any) => (
                <tr key={emp.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-4 font-semibold text-slate-900">{emp.fullName}</td>
                  <td className="py-3 px-4 text-slate-500">{emp.designation || '-'}</td>
                  <td className="py-3 px-4">{emp.totalTasks}</td>
                  <td className="py-3 px-4 text-emerald-600 font-semibold">{emp.completedTasks}</td>
                  <td className="py-3 px-4 text-amber-600 font-semibold">{emp.pendingTasks}</td>
                  <td className="py-3 px-4 text-rose-600 font-semibold">{emp.overdueTasks}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{emp.completionRate}%</span>
                      <div className="w-16 bg-slate-100 rounded-full h-1.5">
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full"
                          style={{ width: `${emp.completionRate}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono font-medium">{emp.monthlyHours} hrs</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

