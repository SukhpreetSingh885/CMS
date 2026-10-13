import { prisma } from '../config/db.js';
import { TaskStatus, ReportStatus, PaymentStatus } from '@prisma/client';
import { buildPrismaDateFilter } from '../utils/dateRange.js';
import { DeliverableProgressService } from './deliverable-progress.service.js';
import { FinanceService } from './finance.service.js';

export class ReportService {
  /**
   * 1. Client Delivery Report
   */
  static async getClientDeliveryReport(filters: {
    clientId?: string;
    status?: any;
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: any = { isArchived: false };
    if (filters.clientId) where.id = filters.clientId;
    if (filters.status) where.status = filters.status;
    const dateFilter = buildPrismaDateFilter(filters);
    if (dateFilter) {
      where.createdAt = dateFilter;
    }

    const clients = await prisma.client.findMany({
      where,
      include: {
        package: true,
        services: {
          include: {
            service: true,
            assignedEmployee: { select: { fullName: true } },
          },
        },
        tasks: {
          select: {
            id: true,
            title: true,
            serviceId: true,
            status: true,
            completionPercentage: true,
            deliverableCount: true,
            clientApprovalRequired: true,
            internalNotes: true,
            dueDate: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    return clients.map((c) => {
      let totalTarget = 0;
      let totalCompleted = 0;
      let totalWeight = 0;
      let weightedComp = 0;

      const servicesBreakdown = c.services.map((s) => {
        const metrics = DeliverableProgressService.calculateClientServiceMetrics(
          { ...s, client: c },
          c.tasks,
          filters
        );
        const weight = Number(s.serviceWeight) || 1.0;
        const pct = metrics.overallProgressPercent;

        totalTarget += metrics.totalTargetUnits;
        totalCompleted += metrics.totalApprovedUnits;
        totalWeight += weight;
        weightedComp += pct * weight;

        return {
          serviceName: s.service.name,
          assignedTo: s.assignedEmployee?.fullName || 'Unassigned',
          target: metrics.totalTargetUnits,
          completed: metrics.totalApprovedUnits,
          completionPercentage: pct,
          agreedDeliverables: metrics.agreedDeliverablesSummary,
          targetPeriod: metrics.targetPeriodSummary,
          deliverablesBreakdown: metrics.items,
        };
      });

      const overallProgress = totalWeight > 0 ? Math.min(100, Math.round(weightedComp / totalWeight)) : 0;

      return {
        clientId: c.id,
        companyName: c.companyName,
        packageName: c.package?.name || 'Custom',
        status: c.status,
        overallDeliveryProgress: overallProgress,
        totalDeliverablesTarget: totalTarget,
        totalDeliverablesCompleted: totalCompleted,
        services: servicesBreakdown,
      };
    });
  }

  /**
   * 2. Employee Daily Work Report
   */
  static async getEmployeeWorkReport(filters: {
    userId?: string;
    clientId?: string;
    startDate?: string;
    endDate?: string;
    dateFrom?: string;
    dateTo?: string;
    dateRange?: string;
    status?: ReportStatus;
  }) {
    const where: any = {};
    if (filters.userId) where.submittedById = filters.userId;
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.status) where.status = filters.status;
    const dateFilter = buildPrismaDateFilter(filters);
    if (dateFilter) {
      where.reportDate = dateFilter;
    }

    const reports = await prisma.dailyWorkReport.findMany({
      where,
      orderBy: { reportDate: 'desc' },
      include: {
        submittedBy: { select: { fullName: true, employeeId: true, designation: true } },
        client: { select: { companyName: true } },
        service: { select: { name: true } },
        task: { select: { title: true } },
        reviewer: { select: { fullName: true } },
      },
    });

    return reports.map((r) => ({
      id: r.id,
      date: r.reportDate.toISOString().slice(0, 10),
      employeeName: r.submittedBy.fullName,
      employeeId: r.submittedBy.employeeId,
      clientName: r.client.companyName,
      serviceName: r.service?.name || '-',
      taskTitle: r.task?.title || '-',
      hoursSpent: Number(r.hoursSpent),
      workCompleted: r.workCompleted,
      workPending: r.workPending || '-',
      status: r.status,
      reviewerName: r.reviewer?.fullName || '-',
      reviewerComments: r.reviewerComments || '-',
    }));
  }

  /**
   * 3. Employee Productivity Report
   */
  static async getEmployeeProductivityReport(query?: {
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const taskDateFilter = query ? buildPrismaDateFilter(query) : undefined;
    const reportDateFilter = query ? buildPrismaDateFilter(query) : undefined;

    const employees = await prisma.user.findMany({
      where: { role: 'EMPLOYEE' },
      include: {
        tasksAssigned: taskDateFilter
          ? {
              where: {
                OR: [
                  { dueDate: taskDateFilter },
                  { createdAt: taskDateFilter },
                ],
              },
            }
          : true,
        dailyReportsSubmitted: reportDateFilter
          ? {
              where: {
                reportDate: reportDateFilter,
              },
            }
          : true,
      },
      orderBy: { fullName: 'asc' },
    });

    const now = new Date();
    return employees.map((emp) => {
      const totalTasks = emp.tasksAssigned.length;
      const completedTasks = emp.tasksAssigned.filter((t) =>
        ([TaskStatus.COMPLETED, TaskStatus.DELIVERED, TaskStatus.APPROVED] as TaskStatus[]).includes(t.status)
      ).length;
      const pendingTasks = totalTasks - completedTasks;
      const overdueTasks = emp.tasksAssigned.filter(
        (t) =>
          t.dueDate < now &&
          !([TaskStatus.COMPLETED, TaskStatus.DELIVERED, TaskStatus.APPROVED] as TaskStatus[]).includes(t.status)
      ).length;

      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      const rawTotalHours = emp.dailyReportsSubmitted.reduce(
        (sum, r) => sum + Number(r.hoursSpent || 0),
        0
      );
      const totalHours = Math.round(rawTotalHours * 10) / 10;
      const approvedReports = emp.dailyReportsSubmitted.filter(
        (r) => r.status === ReportStatus.APPROVED
      ).length;

      return {
        employeeId: emp.employeeId || '-',
        fullName: emp.fullName,
        designation: emp.designation || '-',
        department: emp.department || '-',
        totalTasksAssigned: totalTasks,
        completedTasks,
        totalTasksCompleted: completedTasks,
        pendingTasks,
        overdueTasks,
        taskCompletionRate: completionRate,
        totalWorkHoursLogged: totalHours,
        totalLoggedHours: totalHours,
        reportsSubmitted: emp.dailyReportsSubmitted.length,
        reportsApproved: approvedReports,
        approvedReportsCount: approvedReports,
      };
    });
  }

  /**
   * 4. Service Performance Report
   */
  static async getServicePerformanceReport(filters?: {
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const services = await prisma.service.findMany({
      include: {
        clientServices: {
          include: {
            client: {
              select: {
                id: true,
                companyName: true,
                status: true,
                isArchived: true,
                billingCycle: true,
                contractSnapshot: true,
              },
            },
            service: true,
          },
        },
        packageServices: {
          include: {
            package: { select: { name: true, billingCycle: true } },
            deliverablesList: true,
          },
        },
        tasks: {
          select: {
            id: true,
            title: true,
            serviceId: true,
            status: true,
            completionPercentage: true,
            deliverableCount: true,
            clientApprovalRequired: true,
            internalNotes: true,
            dueDate: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const activeFilter = filters
      ? {
          dateRange: filters.dateRange,
          startDate: filters.startDate || filters.dateFrom,
          endDate: filters.endDate || filters.dateTo,
        }
      : undefined;

    return services.map((svc) =>
      DeliverableProgressService.aggregateServicePerformance(svc, activeFilter)
    );
  }

  /**
   * 5 & 6. Tasks Report (Pending & Overdue)
   */
  static async getTasksReport(
    filter: 'all' | 'pending' | 'overdue' = 'all',
    query?: { dateRange?: string; startDate?: string; endDate?: string; dateFrom?: string; dateTo?: string }
  ) {
    const now = new Date();
    const where: any = {};

    if (filter === 'pending') {
      where.status = { notIn: [TaskStatus.COMPLETED, TaskStatus.DELIVERED, TaskStatus.APPROVED] };
    } else if (filter === 'overdue') {
      where.dueDate = { lt: now };
      where.status = { notIn: [TaskStatus.COMPLETED, TaskStatus.DELIVERED, TaskStatus.APPROVED] };
    }

    if (query) {
      const dateFilter = buildPrismaDateFilter(query);
      if (dateFilter) {
        where.dueDate = where.dueDate ? { ...where.dueDate, ...dateFilter } : dateFilter;
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      include: {
        client: { select: { companyName: true } },
        service: { select: { name: true } },
        assignedTo: { select: { fullName: true } },
      },
    });

    return tasks.map((t) => ({
      taskId: t.id,
      title: t.title,
      clientName: t.client.companyName,
      serviceName: t.service?.name || '-',
      assignedTo: t.assignedTo.fullName,
      priority: t.priority,
      status: t.status,
      completionPercentage: t.completionPercentage,
      dueDate: t.dueDate.toISOString().slice(0, 10),
      isOverdue:
        t.dueDate < now &&
        !([TaskStatus.COMPLETED, TaskStatus.DELIVERED, TaskStatus.APPROVED] as TaskStatus[]).includes(t.status),
    }));
  }

  /**
   * 7, 8, 9. Revenue and Payment Collection Report
   */
  static async getRevenueAndPaymentReport(query?: {
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const invoiceWhere: any = {
      isCancelled: false,
      paymentStatus: { notIn: [PaymentStatus.CANCELLED, PaymentStatus.VOID] },
    };
    const paymentWhere: any = {
      isVoided: false,
      invoice: {
        isCancelled: false,
        paymentStatus: { notIn: [PaymentStatus.CANCELLED, PaymentStatus.VOID] },
      },
    };
    if (query) {
      const dateFilter = buildPrismaDateFilter(query);
      if (dateFilter) {
        invoiceWhere.invoiceDate = dateFilter;
        paymentWhere.paymentDate = dateFilter;
      }
    }

    const [invoices, payments, receivedData] = await Promise.all([
      prisma.invoice.findMany({
        where: invoiceWhere,
        orderBy: { invoiceDate: 'desc' },
        include: { client: { select: { companyName: true } } },
      }),
      prisma.payment.findMany({
        where: paymentWhere,
        orderBy: { paymentDate: 'desc' },
        include: {
          client: { select: { companyName: true } },
          invoice: { select: { invoiceNumber: true } },
        },
      }),
      FinanceService.calculateReceivedMoney(query),
    ]);

    let totalInvoiced = 0;
    let totalPending = 0;
    let totalOverdue = 0;

    const invoiceList = invoices.map((inv) => {
      const amt = Number(inv.invoiceAmount);
      const paid = Number(inv.amountPaid);
      const balance = Number(inv.remainingBalance);

      totalInvoiced += amt;
      totalPending += balance;
      if (inv.paymentStatus === PaymentStatus.OVERDUE) {
        totalOverdue += balance;
      }

      return {
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.client.companyName,
        invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
        dueDate: inv.dueDate.toISOString().slice(0, 10),
        amount: amt,
        amountPaid: paid,
        remainingBalance: balance,
        status: inv.paymentStatus,
      };
    });

    return {
      summary: {
        totalInvoiced,
        totalCollected: receivedData.totalReceivedMoney,
        totalReceivedMoney: receivedData.totalReceivedMoney,
        allTimeReceivedMoney: receivedData.allTimeReceivedMoney,
        totalPending,
        totalOverdue,
        paymentCount: receivedData.periodPaymentCount,
        allTimePaymentCount: receivedData.paymentCount,
        breakdown: receivedData.breakdown,
        filterApplied: receivedData.filterApplied,
      },
      invoices: invoiceList,
      recentPayments: payments.map((p) => ({
        id: p.id,
        invoiceNumber: p.invoice.invoiceNumber,
        clientName: p.client.companyName,
        amount: Number(p.amount),
        date: p.paymentDate.toISOString().slice(0, 10),
        method: p.paymentMethod,
        ref: p.transactionReference || '-',
      })),
    };
  }

  /**
   * 10. Client Renewal Report
   */
  static async getRenewalReport(query?: {
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: any = {};
    if (query) {
      const dateFilter = buildPrismaDateFilter(query);
      if (dateFilter) {
        where.renewalDate = dateFilter;
      }
    }

    const renewals = await prisma.renewal.findMany({
      where,
      orderBy: { renewalDate: 'asc' },
      include: {
        client: {
          select: {
            companyName: true,
            contactPerson: true,
            email: true,
            mobileNumber: true,
            package: { select: { name: true } },
          },
        },
      },
    });

    const now = new Date();
    return renewals.map((r) => {
      const diffMs = r.renewalDate.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      return {
        renewalId: r.id,
        clientName: r.client.companyName,
        contactPerson: r.client.contactPerson,
        contactEmail: r.client.email,
        contactPhone: r.client.mobileNumber,
        packageName: r.client.package?.name || '-',
        contractStartDate: r.contractStartDate.toISOString().slice(0, 10),
        contractEndDate: r.contractEndDate.toISOString().slice(0, 10),
        renewalDate: r.renewalDate.toISOString().slice(0, 10),
        renewalAmount: Number(r.renewalAmount),
        status: r.renewalStatus,
        daysLeft,
      };
    });
  }
}
