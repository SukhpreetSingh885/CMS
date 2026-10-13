import { prisma } from '../config/db.js';
import { Role, UserStatus, ClientStatus, TaskStatus, ReportStatus, PaymentStatus, RenewalStatus } from '@prisma/client';
import { MAX_ADMIN_LIMIT } from '../config/constants.js';
import { ClientService } from './client.service.js';
import { FinanceService } from './finance.service.js';

export class DashboardService {
  /**
   * Admin Dashboard KPIs and Sections with real database queries
   */
  static async getAdminDashboard(query?: {
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalClients,
      activeClients,
      totalEmployees,
      totalAdmins,
      activeAdmins,
      tasksToday,
      tasksCompleted,
      pendingTasks,
      overdueTasks,
      pendingReportsCount,
      invoices,
      upcomingRenewalsCount,
      recentReports,
      overdueTaskList,
      todayTasks,
      upcomingMeetings,
      recentActivity,
      allClientsWithServices,
      allEmployees,
    ] = await Promise.all([
      // 1. Total Clients
      prisma.client.count({ where: { isArchived: false } }),
      // 2. Active Clients
      prisma.client.count({ where: { isArchived: false, status: ClientStatus.ACTIVE } }),
      // 3. Total Employees
      prisma.user.count({ where: { role: Role.EMPLOYEE } }),
      // 4. Total Admins (Count both active and disabled toward 5 limit)
      prisma.user.count({ where: { role: Role.ADMIN } }),
      // 5. Active Admins
      prisma.user.count({ where: { role: Role.ADMIN, status: UserStatus.ACTIVE } }),
      // 6. Tasks assigned today
      prisma.task.count({ where: { createdAt: { gte: todayStart } } }),
      // 7. Tasks completed
      prisma.task.count({ where: { status: { in: [TaskStatus.COMPLETED, TaskStatus.DELIVERED, TaskStatus.APPROVED] } } }),
      // 8. Pending tasks
      prisma.task.count({
        where: {
          status: { notIn: [TaskStatus.COMPLETED, TaskStatus.DELIVERED, TaskStatus.APPROVED] },
        },
      }),
      // 9. Overdue tasks
      prisma.task.count({
        where: {
          dueDate: { lt: now },
          status: { notIn: [TaskStatus.COMPLETED, TaskStatus.DELIVERED, TaskStatus.APPROVED] },
        },
      }),
      // 10. Pending report approvals
      prisma.dailyWorkReport.count({
        where: { status: { in: [ReportStatus.SUBMITTED, ReportStatus.UNDER_REVIEW] } },
      }),
      // 11. Invoices for financial KPI calculations
      prisma.invoice.findMany({
        where: {
          isCancelled: false,
          paymentStatus: { notIn: [PaymentStatus.CANCELLED, PaymentStatus.VOID] },
        },
        select: {
          invoiceAmount: true,
          amountPaid: true,
          remainingBalance: true,
          paymentStatus: true,
          isCancelled: true,
          createdAt: true,
          client: { select: { billingCycle: true } },
        },
      }),
      // 12. Upcoming renewals (within next 30 days)
      prisma.renewal.count({
        where: {
          renewalDate: {
            gte: now,
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          renewalStatus: { in: [RenewalStatus.UPCOMING, RenewalStatus.DUE] },
        },
      }),
      // 13. Recent daily reports
      prisma.dailyWorkReport.findMany({
        take: 6,
        orderBy: { reportDate: 'desc' },
        include: {
          submittedBy: { select: { id: true, fullName: true, designation: true } },
          client: { select: { id: true, companyName: true } },
        },
      }),
      // 14. Overdue task list
      prisma.task.findMany({
        where: {
          dueDate: { lt: now },
          status: { notIn: [TaskStatus.COMPLETED, TaskStatus.DELIVERED, TaskStatus.APPROVED] },
        },
        take: 6,
        orderBy: { dueDate: 'asc' },
        include: {
          client: { select: { id: true, companyName: true } },
          assignedTo: { select: { id: true, fullName: true } },
        },
      }),
      // 15. Today's task list
      prisma.task.findMany({
        where: {
          dueDate: { gte: todayStart, lte: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000) },
        },
        take: 6,
        orderBy: { priority: 'desc' },
        include: {
          client: { select: { id: true, companyName: true } },
          assignedTo: { select: { id: true, fullName: true } },
        },
      }),
      // 16. Upcoming meetings
      prisma.meeting.findMany({
        where: { meetingDateTime: { gte: now } },
        take: 5,
        orderBy: { meetingDateTime: 'asc' },
        include: { client: { select: { id: true, companyName: true } } },
      }),
      // 17. Recent activity logs
      prisma.auditLog.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
      // 18. Client delivery progress data
      prisma.client.findMany({
        where: { isArchived: false, status: { in: [ClientStatus.ACTIVE, ClientStatus.ONBOARDING, ClientStatus.RENEWAL_DUE] } },
        take: 8,
        include: {
          services: true,
          package: { select: { name: true } },
        },
      }),
      // 19. Employees productivity overview
      prisma.user.findMany({
        where: { role: Role.EMPLOYEE, status: UserStatus.ACTIVE },
        take: 6,
        include: {
          tasksAssigned: {
            select: { status: true, dueDate: true, completionPercentage: true },
          },
          dailyReportsSubmitted: {
            where: { createdAt: { gte: monthStart } },
            select: { hoursSpent: true, status: true },
          },
        },
      }),
    ]);

    // Financial calculations
    let monthlyRecurringRevenue = 0;
    let monthlyOneTimeRevenue = 0;
    let monthlyRevenue = 0;
    let pendingPayments = 0;

    invoices.forEach((inv) => {
      const amt = Number(inv.invoiceAmount);
      const balance = Number(inv.remainingBalance);
      if (inv.createdAt >= monthStart) {
        if (inv.client?.billingCycle === 'ONE_TIME') {
          monthlyOneTimeRevenue += amt;
        } else {
          monthlyRecurringRevenue += amt;
        }
        monthlyRevenue += amt;
      }
      pendingPayments += balance;
    });

    // Active clients MRR calculation (strictly active recurring contracts normalized to monthly)
    const activeClientsBilling = await prisma.client.findMany({
      where: { isArchived: false, status: { in: [ClientStatus.ACTIVE, ClientStatus.ONBOARDING] } },
      select: { packagePricing: true, billingCycle: true, status: true },
    });

    let mrr = 0;
    let oneTimeContractVal = 0;
    activeClientsBilling.forEach((c) => {
      const price = Number(c.packagePricing || 0);
      if (c.billingCycle === 'MONTHLY') {
        if (c.status === ClientStatus.ACTIVE) mrr += price;
      } else if (c.billingCycle === 'QUARTERLY') {
        if (c.status === ClientStatus.ACTIVE) mrr += Math.round(price / 3);
      } else if (c.billingCycle === 'YEARLY') {
        if (c.status === ClientStatus.ACTIVE) mrr += Math.round(price / 12);
      } else if (c.billingCycle === 'ONE_TIME') {
        oneTimeContractVal += price;
      }
    });

    // Client delivery progress list
    const clientDeliveryList = allClientsWithServices.map((c) => {
      let totalDeliverables = 0;
      let completedDeliverables = 0;
      let totalWeight = 0;
      let weightedCompletion = 0;

      c.services.forEach((s) => {
        const target = s.monthlyTarget || 1;
        const completed = s.completedDeliverables || 0;
        const weight = Number(s.serviceWeight) || 1.0;

        totalDeliverables += target;
        completedDeliverables += completed;
        totalWeight += weight;

        const svcComp = Math.min(100, Math.round((completed / target) * 100));
        weightedCompletion += svcComp * weight;
      });

      const deliveryProgress =
        totalWeight > 0 ? Math.min(100, Math.round(weightedCompletion / totalWeight)) : 0;

      return {
        id: c.id,
        companyName: c.companyName,
        packageName: c.package?.name || 'Custom',
        status: c.status,
        servicesCount: c.services.length,
        deliveryProgress,
      };
    });

    // Employee productivity summary list
    const employeeProductivityList = allEmployees.map((emp) => {
      const totalTasks = emp.tasksAssigned.length;
      const completed = emp.tasksAssigned.filter((t) =>
        ([TaskStatus.COMPLETED, TaskStatus.DELIVERED, TaskStatus.APPROVED] as TaskStatus[]).includes(t.status)
      ).length;
      const pending = totalTasks - completed;
      const overdue = emp.tasksAssigned.filter(
        (t) =>
          t.dueDate < now &&
          !([TaskStatus.COMPLETED, TaskStatus.DELIVERED, TaskStatus.APPROVED] as TaskStatus[]).includes(t.status)
      ).length;

      const completionRate = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;
      const totalHours = emp.dailyReportsSubmitted.reduce(
        (acc, curr) => acc + Number(curr.hoursSpent),
        0
      );

      return {
        id: emp.id,
        fullName: emp.fullName,
        designation: emp.designation,
        totalTasks,
        completedTasks: completed,
        pendingTasks: pending,
        overdueTasks: overdue,
        completionRate,
        monthlyHours: totalHours,
        reportsCount: emp.dailyReportsSubmitted.length,
      };
    });

    // Valid received money calculated strictly from MySQL payment records
    const receivedMoneyData = await FinanceService.calculateReceivedMoney(query);

    return {
      kpis: {
        totalClients,
        activeClients,
        totalEmployees,
        overdueTasks,
        tasksAssignedToday: tasksToday,
        tasksCompleted,
        pendingTasks,
        pendingReportApprovals: pendingReportsCount,
        totalReceivedMoney: receivedMoneyData.totalReceivedMoney,
        allTimeReceivedMoney: receivedMoneyData.allTimeReceivedMoney,
        receivedPaymentsCount: receivedMoneyData.periodPaymentCount,
        allTimePaymentsCount: receivedMoneyData.paymentCount,
        receivedMoneyBreakdown: receivedMoneyData.breakdown,
        filterApplied: receivedMoneyData.filterApplied,
        monthlyRevenue: mrr > 0 ? mrr : monthlyRecurringRevenue,
        monthlyRecurringRevenue: mrr > 0 ? mrr : monthlyRecurringRevenue,
        mrr: mrr > 0 ? mrr : monthlyRecurringRevenue,
        oneTimeProjectContractValue: oneTimeContractVal,
        monthlyOneTimeRevenue,
        totalMonthlyRevenue: monthlyRevenue,
        paymentsPending: pendingPayments,
        upcomingRenewals: upcomingRenewalsCount,
      },
      sections: {
        clientDeliveryProgress: clientDeliveryList,
        employeeProductivity: employeeProductivityList,
        recentDailyReports: recentReports,
        overdueTasks: overdueTaskList,
        todayTasks,
        upcomingMeetings,
        recentActivity,
      },
    };
  }

  /**
   * Employee Dashboard KPIs and Sections
   */
  static async getEmployeeDashboard(userId: string) {
    // Ensure any service-level or task-level assignments are synced into ClientAssignedEmployee
    await ClientService.syncEmployeeClientAssignments(userId);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      myTasks,
      myClientsCount,
      myReportsSubmitted,
      myReportsAwaitingReview,
      todayTasks,
      upcomingDeadlines,
      myClients,
      recentReports,
      notifications,
    ] = await Promise.all([
      // Tasks assigned to this employee
      prisma.task.findMany({
        where: { assignedToId: userId },
        include: { client: { select: { companyName: true } } },
      }),
      // Clients assigned (active/non-archived)
      prisma.clientAssignedEmployee.count({
        where: { userId, client: { isArchived: false } },
      }),
      // Reports submitted
      prisma.dailyWorkReport.count({
        where: { submittedById: userId, status: { not: ReportStatus.DRAFT } },
      }),
      // Reports awaiting review
      prisma.dailyWorkReport.count({
        where: {
          submittedById: userId,
          status: { in: [ReportStatus.SUBMITTED, ReportStatus.UNDER_REVIEW] },
        },
      }),
      // Today's tasks
      prisma.task.findMany({
        where: {
          assignedToId: userId,
          dueDate: { gte: todayStart, lte: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000) },
        },
        include: { client: { select: { companyName: true } } },
      }),
      // Upcoming deadlines (next 7 days)
      prisma.task.findMany({
        where: {
          assignedToId: userId,
          dueDate: { gte: now, lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
          status: { notIn: [TaskStatus.COMPLETED, TaskStatus.DELIVERED, TaskStatus.APPROVED] },
        },
        orderBy: { dueDate: 'asc' },
        take: 6,
        include: { client: { select: { companyName: true } } },
      }),
      // Assigned clients with services and team assignments
      prisma.clientAssignedEmployee.findMany({
        where: { userId, client: { isArchived: false } },
        include: {
          client: {
            include: {
              package: { select: { id: true, name: true } },
              services: {
                include: {
                  service: true,
                  assignedEmployee: {
                    select: { id: true, fullName: true, designation: true },
                  },
                  assignedEmployees: {
                    where: { isActive: true },
                    include: {
                      employee: {
                        select: { id: true, fullName: true, designation: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      // Recent submitted reports
      prisma.dailyWorkReport.findMany({
        where: { submittedById: userId },
        take: 5,
        orderBy: { reportDate: 'desc' },
        include: {
          client: { select: { companyName: true } },
          reviewer: { select: { fullName: true } },
        },
      }),
      // Notifications
      prisma.notification.findMany({
        where: { userId },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalAssigned = myTasks.length;
    const completed = myTasks.filter((t) =>
      ([TaskStatus.COMPLETED, TaskStatus.DELIVERED, TaskStatus.APPROVED] as TaskStatus[]).includes(t.status)
    ).length;
    const pending = totalAssigned - completed;
    const overdue = myTasks.filter(
      (t) =>
        t.dueDate < now &&
        !([TaskStatus.COMPLETED, TaskStatus.DELIVERED, TaskStatus.APPROVED] as TaskStatus[]).includes(t.status)
    ).length;

    const todayCompletedCount = todayTasks.filter((t) =>
      ([TaskStatus.COMPLETED, TaskStatus.DELIVERED, TaskStatus.APPROVED] as TaskStatus[]).includes(t.status)
    ).length;
    const todayWorkCompletion =
      todayTasks.length > 0 ? Math.round((todayCompletedCount / todayTasks.length) * 100) : 100;

    return {
      kpis: {
        myAssignedTasks: totalAssigned,
        myCompletedTasks: completed,
        myPendingTasks: pending,
        myOverdueTasks: overdue,
        todayWorkCompletion,
        reportsSubmitted: myReportsSubmitted,
        reportsAwaitingReview: myReportsAwaitingReview,
        assignedClientsCount: myClientsCount,
      },
      sections: {
        todayTasks,
        upcomingDeadlines,
        assignedClients: myClients.map((c) => {
          const normalizedServices = (c.client.services || []).map((s) =>
            ClientService.normalizeServiceTeam(s)
          );
          const myServices = normalizedServices.filter(
            (s) =>
              s.assignedEmployeeId === userId ||
              (s.assignedEmployees || []).some((ae: any) => ae.employeeId === userId)
          );

          let totalWeight = 0;
          let weightedCompletion = 0;
          normalizedServices.forEach((s) => {
            const target = s.monthlyTarget || 1;
            const comp = s.completedDeliverables || 0;
            const weight = Number(s.serviceWeight) || 1.0;
            totalWeight += weight;
            weightedCompletion += Math.min(100, Math.round((comp / target) * 100)) * weight;
          });
          const deliveryProgress =
            totalWeight > 0 ? Math.min(100, Math.round(weightedCompletion / totalWeight)) : 0;

          return {
            id: c.client.id,
            companyName: c.client.companyName,
            industry: c.client.industry,
            status: c.client.status,
            packageName: c.client.package?.name || 'Custom Retainer',
            deliveryProgress,
            services: normalizedServices.map((s) => s.service.name),
            myServices: myServices.map((s) => ({
              id: s.id,
              serviceId: s.serviceId,
              serviceName: s.service.name,
              monthlyTarget: s.monthlyTarget,
              completedDeliverables: s.completedDeliverables,
              deliverables: s.deliverables,
              teamMembers: (s.assignedEmployees || []).map((ae: any) => ae.employee),
            })),
          };
        }),
        recentSubmittedReports: recentReports,
        notifications,
      },
    };
  }

  /**
   * Analytics & Chart Insights dynamically computed from real MySQL records
   */
  static async getAnalyticsInsights() {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [invoices, payments, clientServices, employees] = await Promise.all([
      prisma.invoice.findMany({
        where: { invoiceDate: { gte: sixMonthsAgo } },
        select: { invoiceAmount: true, amountPaid: true, invoiceDate: true },
      }),
      prisma.payment.findMany({
        where: { paymentDate: { gte: sixMonthsAgo } },
        select: { amount: true, paymentDate: true },
      }),
      prisma.clientService.findMany({
        include: { service: { select: { name: true } } },
      }),
      prisma.user.findMany({
        where: { role: Role.EMPLOYEE, status: UserStatus.ACTIVE },
        include: {
          tasksAssigned: { select: { status: true } },
        },
      }),
    ]);

    // 1. Monthly revenue and collection grouping for the last 6 months
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const revenueData: Array<{ month: string; revenue: number; collected: number }> = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const yr = d.getFullYear();
      const mName = monthNames[mIdx];

      const monthInvoices = invoices.filter((inv) => {
        const invD = new Date(inv.invoiceDate);
        return invD.getFullYear() === yr && invD.getMonth() === mIdx;
      });

      const monthPayments = payments.filter((p) => {
        const pD = new Date(p.paymentDate);
        return pD.getFullYear() === yr && pD.getMonth() === mIdx;
      });

      const invoicedSum = monthInvoices.reduce((acc, curr) => acc + Number(curr.invoiceAmount), 0);
      const collectedSum = monthPayments.reduce((acc, curr) => acc + Number(curr.amount), 0);

      revenueData.push({
        month: mName,
        revenue: invoicedSum,
        collected: collectedSum,
      });
    }

    // 2. Service Distribution from Client Services
    const serviceCounts: Record<string, number> = {};
    clientServices.forEach((cs) => {
      const sName = cs.service.name;
      serviceCounts[sName] = (serviceCounts[sName] || 0) + 1;
    });

    const totalServicesCount = clientServices.length;
    const colors = ['#7c3aed', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];
    const serviceDistribution = Object.entries(serviceCounts).map(([name, count], index) => ({
      name,
      value: totalServicesCount > 0 ? Math.round((count / totalServicesCount) * 100) : 0,
      count,
      color: colors[index % colors.length],
    }));

    // 3. Employee Performance
    const employeePerformance = employees.map((emp) => {
      const total = emp.tasksAssigned.length;
      const completed = emp.tasksAssigned.filter((t) =>
        ([TaskStatus.COMPLETED, TaskStatus.DELIVERED, TaskStatus.APPROVED] as TaskStatus[]).includes(t.status)
      ).length;

      return {
        name: emp.fullName,
        tasks: total,
        completed,
      };
    });

    return {
      revenueData,
      serviceDistribution,
      employeePerformance,
    };
  }
}
