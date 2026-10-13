import React, { useEffect, useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { dashboardService } from '../../services';
import { BarChart3, PieChart as PieIcon, Users } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export const Analytics: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await dashboardService.getAnalyticsInsights();
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load live analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (isLoading) {
    return <LoadingState message="Calculating real-time agency analytics..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadAnalytics} />;
  }

  const revenueData = data?.revenueData || [];
  const serviceDistribution = data?.serviceDistribution || [];
  const employeePerformance = data?.employeePerformance || [];

  const hasRevenueRecords = revenueData.some((r: any) => r.revenue > 0 || r.collected > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agency Analytics & Visual Insights"
        description="Live agency performance analytics, invoiced vs collected revenue, service capacity, and staff task delivery metrics."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Invoiced vs Collected Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Revenue & Collections (₹ INR)</CardTitle>
          </CardHeader>
          <div className="h-72 w-full">
            {!hasRevenueRecords ? (
              <EmptyState
                icon={BarChart3}
                title="No revenue records yet"
                description="Invoiced and collected revenue will appear here once client invoices are generated and payments are recorded."
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip
                    formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Amount']}
                  />
                  <Bar dataKey="revenue" fill="#7c3aed" radius={[4, 4, 0, 0]} name="Invoiced" />
                  <Bar dataKey="collected" fill="#10b981" radius={[4, 4, 0, 0]} name="Collected" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Service Deliverables Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Service Deliverables Distribution</CardTitle>
          </CardHeader>
          <div className="h-72 w-full flex flex-col items-center justify-center">
            {serviceDistribution.length === 0 ? (
              <EmptyState
                icon={PieIcon}
                title="No active client services"
                description="Service allocation breakdown will appear here once clients are onboarded with assigned service deliverables."
              />
            ) : (
              <>
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie
                      data={serviceDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {serviceDistribution.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [`${value}%`, 'Share']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-3 text-xs font-semibold text-slate-600 mt-2">
                  {serviceDistribution.map((s: any) => (
                    <span key={s.name} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name} ({s.count})
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Staff Delivery Efficiency Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Deliverables Completion Performance</CardTitle>
        </CardHeader>
        <div className="h-72 w-full">
          {employeePerformance.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No active staff members or tasks"
              description="Staff task completion comparison will be calculated here once team members are added and tasks are assigned."
            />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={employeePerformance}
                layout="vertical"
                margin={{ top: 10, right: 20, left: 40, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="tasks" fill="#94a3b8" radius={[0, 4, 4, 0]} name="Assigned Tasks" />
                <Bar dataKey="completed" fill="#7c3aed" radius={[0, 4, 4, 0]} name="Completed Tasks" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
};
