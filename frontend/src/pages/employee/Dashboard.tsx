import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Clock,
  Briefcase,
  FileText,
  AlertCircle,
  ArrowUpRight,
  Send,
  Calendar,
} from 'lucide-react';
import { dashboardService } from '../../services';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { formatDate } from '../../utils/formatters';
import { Link } from 'react-router-dom';

import { ErrorState } from '../../components/common/ErrorState';

export const EmployeeDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await dashboardService.getEmployeeDashboard();
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load employee dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (isLoading) {
    return <LoadingState message="Loading your workspace..." />;
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Employee Workspace"
          description="Your daily assigned tasks, client deliverable targets, and daily reporting hub."
        />
        <ErrorState
          message={error || 'Unable to retrieve your workspace data. Please try again.'}
          onRetry={loadDashboard}
        />
      </div>
    );
  }

  const { kpis, sections } = data || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Employee Workspace"
        description="Your daily assigned tasks, client deliverable targets, and daily reporting hub."
        actions={
          <Link to="/employee/daily-report">
            <Button size="sm" className="flex items-center gap-1.5">
              <Send className="w-4 h-4" /> Submit Today's Report
            </Button>
          </Link>
        }
      />

      {/* Employee KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="My Assigned Tasks"
          value={kpis?.myAssignedTasks || 0}
          subtitle={`${kpis?.myCompletedTasks || 0} completed`}
          icon={CheckSquare}
          color="purple"
        />

        <StatCard
          title="Pending Tasks"
          value={kpis?.myPendingTasks || 0}
          subtitle={`${kpis?.myOverdueTasks || 0} overdue items`}
          icon={Clock}
          color="amber"
        />

        <StatCard
          title="Today's Work Done"
          value={`${kpis?.todayWorkCompletion || 0}%`}
          subtitle="Daily milestone completion"
          icon={CheckSquare}
          color="emerald"
        />

        <StatCard
          title="Reports Submitted"
          value={kpis?.reportsSubmitted || 0}
          subtitle={`${kpis?.reportsAwaitingReview || 0} awaiting review`}
          icon={FileText}
          color="blue"
        />
      </div>

      {/* Today's Tasks & Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Today's Task List</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">Tasks scheduled or due today</p>
              </div>
              <Link
                to="/employee/my-tasks"
                className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                View all tasks <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>

            <div className="divide-y divide-slate-100">
              {sections?.todayTasks?.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No tasks scheduled for today.</p>
              ) : (
                sections?.todayTasks?.map((t: any) => (
                  <div key={t.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{t.title}</p>
                      <p className="text-[11px] text-purple-700 font-medium">{t.client?.companyName}</p>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Assigned Clients */}
          <Card>
            <CardHeader>
              <CardTitle>My Assigned Client Accounts</CardTitle>
              <Link
                to="/employee/my-clients"
                className="text-xs font-semibold text-purple-600 hover:text-purple-700"
              >
                View all ({sections?.assignedClients?.length || 0})
              </Link>
            </CardHeader>

            {(!sections?.assignedClients || sections.assignedClients.length === 0) ? (
              <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-xs font-semibold text-slate-600">No clients assigned yet.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Clients and services assigned to you by Admin will appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sections.assignedClients.map((c: any) => {
                  const mySvcNames = Array.isArray(c.myServices) && c.myServices.length > 0
                    ? c.myServices.map((ms: any) => ms.serviceName)
                    : c.services || [];

                  return (
                    <Link
                      key={c.id}
                      to={`/employee/my-clients?clientId=${c.id}`}
                      className="p-3.5 bg-slate-50 hover:bg-purple-50/40 rounded-xl border border-slate-200 hover:border-purple-200 transition-all block"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-900">{c.companyName}</p>
                          <p className="text-[10px] text-purple-700 font-semibold mt-0.5">
                            {c.packageName || 'Client Retainer'}
                          </p>
                        </div>
                        {c.status && <StatusBadge status={c.status} />}
                      </div>

                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {mySvcNames.length > 0 ? (
                          mySvcNames.map((svcName: string, i: number) => (
                            <span
                              key={i}
                              className="text-[10px] font-semibold bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200"
                            >
                              {svcName}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-400">Active Retainer</span>
                        )}
                      </div>

                      {typeof c.deliveryProgress === 'number' && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                          <span className="text-slate-500">Deliverable Progress</span>
                          <span className="font-bold text-slate-800">{c.deliveryProgress}%</span>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Upcoming Deadlines & Recent Reports */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-amber-700">
                <Clock className="w-4 h-4" /> Upcoming Deadlines
              </CardTitle>
            </CardHeader>
            <div className="space-y-2.5">
              {sections?.upcomingDeadlines?.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">No urgent deadlines approaching.</p>
              ) : (
                sections?.upcomingDeadlines?.map((t: any) => (
                  <div key={t.id} className="p-2.5 bg-amber-50/60 rounded-lg border border-amber-100 text-xs">
                    <p className="font-bold text-slate-900 truncate">{t.title}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                      <span>{t.client?.companyName}</span>
                      <span className="font-bold text-amber-800">Due {formatDate(t.dueDate)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>My Recent Reports</CardTitle>
              <Link
                to="/employee/my-reports"
                className="text-xs font-semibold text-purple-600 hover:text-purple-700"
              >
                History
              </Link>
            </CardHeader>
            <div className="space-y-2.5">
              {sections?.recentSubmittedReports?.map((r: any) => (
                <div key={r.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{formatDate(r.reportDate)}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-1">{r.client?.companyName}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

