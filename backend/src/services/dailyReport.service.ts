import { Prisma, ReportStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { AppError, ForbiddenError, NotFoundError } from '../utils/AppError.js';
import { AuditService } from './audit.service.js';
import { buildPrismaDateFilter } from '../utils/dateRange.js';

export interface CreateDailyReportDto {
  reportDate?: string;
  clientId: string;
  taskId?: string | null;
  serviceId?: string | null;
  workDescription: string;
  workCompleted: string;
  workPending?: string | null;
  hoursSpent: number;
  issuesOrBlockers?: string | null;
  nextAction?: string | null;
  isDraft?: boolean;
}

export class DailyReportService {
  /**
   * List daily reports with filters for date range, employee, client, task, service, status, self-reviewed, and search
   */
  static async listReports(query: {
    submittedById?: string;
    clientId?: string;
    taskId?: string;
    serviceId?: string;
    status?: ReportStatus;
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    dateFrom?: string;
    dateTo?: string;
    reviewerId?: string;
    isSelfReviewed?: boolean | string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10));
    const skip = (page - 1) * pageSize;

    const where: Prisma.DailyWorkReportWhereInput = {};

    if (query.submittedById) where.submittedById = query.submittedById;
    if (query.clientId) where.clientId = query.clientId;
    if (query.taskId) where.taskId = query.taskId;
    if (query.serviceId) where.serviceId = query.serviceId;
    if (query.status) where.status = query.status;
    if (query.reviewerId) where.reviewerId = query.reviewerId;

    if (query.isSelfReviewed !== undefined && query.isSelfReviewed !== '') {
      where.isSelfReviewed = query.isSelfReviewed === true || query.isSelfReviewed === 'true';
    }

    const reportDateFilter = buildPrismaDateFilter({
      dateRange: query.dateRange,
      startDate: query.startDate || query.dateFrom,
      endDate: query.endDate || query.dateTo,
    });
    if (reportDateFilter) {
      where.reportDate = reportDateFilter;
    }

    if (query.search) {
      where.OR = [
        { workDescription: { contains: query.search } },
        { workCompleted: { contains: query.search } },
        { workPending: { contains: query.search } },
        { issuesOrBlockers: { contains: query.search } },
        { nextAction: { contains: query.search } },
        { client: { companyName: { contains: query.search } } },
        { submittedBy: { fullName: { contains: query.search } } },
      ];
    }

    // Dynamic sorting
    const validSortFields = ['reportDate', 'createdAt', 'hoursSpent', 'status'];
    const sortBy = query.sortBy && validSortFields.includes(query.sortBy) ? query.sortBy : 'reportDate';
    const sortOrder: Prisma.SortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.DailyWorkReportOrderByWithRelationInput[] = [
      { [sortBy]: sortOrder },
      { createdAt: 'desc' },
    ];

    const [total, reports] = await Promise.all([
      prisma.dailyWorkReport.count({ where }),
      prisma.dailyWorkReport.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          submittedBy: {
            select: { id: true, fullName: true, email: true, role: true, designation: true },
          },
          reviewer: {
            select: { id: true, fullName: true, email: true },
          },
          client: {
            select: { id: true, companyName: true },
          },
          task: {
            select: { id: true, title: true },
          },
          service: {
            select: { id: true, name: true },
          },
          _count: {
            select: { attachments: true, history: true },
          },
        },
      }),
    ]);

    return { total, page, pageSize, reports };
  }

  /**
   * Get single report by ID with history and attachments
   */
  static async getReportById(id: string) {
    const report = await prisma.dailyWorkReport.findUnique({
      where: { id },
      include: {
        submittedBy: {
          select: { id: true, fullName: true, email: true, role: true, designation: true, phone: true },
        },
        reviewer: {
          select: { id: true, fullName: true, email: true },
        },
        client: {
          select: { id: true, companyName: true, contactPerson: true, email: true },
        },
        task: true,
        service: true,
        attachments: true,
        history: {
          orderBy: { modifiedAt: 'desc' },
        },
      },
    });

    if (!report) {
      throw new AppError('Daily work report not found', 404);
    }

    return report;
  }

  /**
   * Create daily work report (either draft or submitted)
   */
  static async createReport(dto: CreateDailyReportDto, submittedById: string, meta?: { ipAddress?: string }) {
    // Verify client assignment for Employees
    const user = await prisma.user.findUnique({ where: { id: submittedById } });
    if (user && user.role === 'EMPLOYEE') {
      const isAssigned = await prisma.clientAssignedEmployee.findUnique({
        where: {
          clientId_userId: {
            clientId: dto.clientId,
            userId: submittedById,
          },
        },
      });

      const isServiceAssigned =
        !isAssigned && prisma.clientService?.findFirst
          ? await prisma.clientService.findFirst({
              where: {
                clientId: dto.clientId,
                OR: [
                  { assignedEmployeeId: submittedById },
                  { assignedEmployees: { some: { employeeId: submittedById, isActive: true } } },
                ],
              },
            })
          : null;

      const isTaskAssigned =
        !isAssigned && !isServiceAssigned && prisma.task?.findFirst
          ? await prisma.task.findFirst({
              where: {
                clientId: dto.clientId,
                assignedToId: submittedById,
              },
            })
          : null;

      if (!isAssigned && !isServiceAssigned && !isTaskAssigned) {
        throw new ForbiddenError('Access forbidden: You are not assigned to this client.');
      }
    }

    const status = dto.isDraft ? ReportStatus.DRAFT : ReportStatus.SUBMITTED;
    const reportDate = dto.reportDate ? new Date(dto.reportDate) : new Date();

    // Prevent duplicate submission within 5 seconds
    if (!dto.isDraft) {
      const duplicateRecent = await prisma.dailyWorkReport.findFirst({
        where: {
          submittedById,
          clientId: dto.clientId,
          reportDate,
          status: ReportStatus.SUBMITTED,
          createdAt: {
            gte: new Date(Date.now() - 5000),
          },
        },
        include: {
          client: true,
          submittedBy: true,
        },
      });
      if (duplicateRecent) {
        return duplicateRecent;
      }
    }

    const report = await prisma.dailyWorkReport.create({
      data: {
        reportDate,
        submittedById,
        clientId: dto.clientId,
        taskId: dto.taskId,
        serviceId: dto.serviceId,
        workDescription: dto.workDescription,
        workCompleted: dto.workCompleted,
        workPending: dto.workPending,
        hoursSpent: dto.hoursSpent,
        issuesOrBlockers: dto.issuesOrBlockers,
        nextAction: dto.nextAction,
        status,
        submittedAt: dto.isDraft ? null : new Date(),
      },
      include: {
        client: true,
        submittedBy: true,
      },
    });

    // Create initial history record
    await prisma.dailyReportHistory.create({
      data: {
        reportId: report.id,
        version: 1,
        workDescription: dto.workDescription,
        workCompleted: dto.workCompleted,
        workPending: dto.workPending,
        hoursSpent: dto.hoursSpent,
        status,
        modifiedById: submittedById,
      },
    });

    await AuditService.log({
      actorId: submittedById,
      actorName: report.submittedBy.fullName,
      actorEmail: report.submittedBy.email,
      action: dto.isDraft ? 'REPORT_SAVED_DRAFT' : 'REPORT_SUBMITTED',
      resourceType: 'DAILY_REPORT',
      resourceId: report.id,
      afterState: report,
      ipAddress: meta?.ipAddress,
    });

    // Automatically notify Admin upon report submission (not for drafts)
    if (!dto.isDraft) {
      await DailyReportService.notifyAdminsForReport(report.id, false);
    }

    return report;
  }

  /**
   * Update report (allowed only if DRAFT or REVISION_REQUESTED)
   */
  static async updateReport(
    id: string,
    dto: Partial<CreateDailyReportDto>,
    userId: string,
    userRole: string,
    meta?: { ipAddress?: string }
  ) {
    const existing = await prisma.dailyWorkReport.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Daily work report not found', 404);
    }

    if (userRole !== 'ADMIN' && existing.submittedById !== userId) {
      throw new AppError('You can only edit your own reports.', 403);
    }

    if (existing.status === ReportStatus.APPROVED) {
      throw new AppError('Approved reports cannot be modified.', 400);
    }

    const currentHistoryCount = await prisma.dailyReportHistory.count({ where: { reportId: id } });

    let shouldNotifyAdmin = false;
    let isRevision = false;

    const updated = await prisma.$transaction(async (tx) => {
      const updateData: any = {};
      if (dto.reportDate) updateData.reportDate = new Date(dto.reportDate);
      if (dto.clientId) updateData.clientId = dto.clientId;
      if (dto.taskId !== undefined) updateData.taskId = dto.taskId;
      if (dto.serviceId !== undefined) updateData.serviceId = dto.serviceId;
      if (dto.workDescription !== undefined) updateData.workDescription = dto.workDescription;
      if (dto.workCompleted !== undefined) updateData.workCompleted = dto.workCompleted;
      if (dto.workPending !== undefined) updateData.workPending = dto.workPending;
      if (dto.hoursSpent !== undefined) updateData.hoursSpent = dto.hoursSpent;
      if (dto.issuesOrBlockers !== undefined) updateData.issuesOrBlockers = dto.issuesOrBlockers;
      if (dto.nextAction !== undefined) updateData.nextAction = dto.nextAction;

      if (dto.isDraft === false && existing.status === ReportStatus.DRAFT) {
        updateData.status = ReportStatus.SUBMITTED;
        updateData.submittedAt = new Date();
        shouldNotifyAdmin = true;
      } else if (existing.status === ReportStatus.REVISION_REQUESTED) {
        updateData.status = ReportStatus.SUBMITTED;
        updateData.submittedAt = new Date();
        shouldNotifyAdmin = true;
        isRevision = true;
      }

      const rep = await tx.dailyWorkReport.update({
        where: { id },
        data: updateData,
      });

      // Save version history snapshot
      await tx.dailyReportHistory.create({
        data: {
          reportId: id,
          version: currentHistoryCount + 1,
          workDescription: rep.workDescription,
          workCompleted: rep.workCompleted,
          workPending: rep.workPending,
          hoursSpent: rep.hoursSpent,
          status: rep.status,
          reviewerComments: rep.reviewerComments,
          modifiedById: userId,
        },
      });

      return rep;
    });

    if (shouldNotifyAdmin) {
      await DailyReportService.notifyAdminsForReport(id, isRevision);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    await AuditService.log({
      actorId: userId,
      actorName: user?.fullName,
      actorEmail: user?.email,
      action: 'REPORT_UPDATED',
      resourceType: 'DAILY_REPORT',
      resourceId: id,
      beforeState: existing,
      afterState: updated,
      ipAddress: meta?.ipAddress,
    });

    return updated;
  }

  /**
   * Submit a draft report
   */
  static async submitDraft(id: string, userId: string, meta?: { ipAddress?: string }) {
    const existing = await prisma.dailyWorkReport.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Daily work report not found', 404);
    }
    if (existing.submittedById !== userId) {
      throw new AppError('You can only submit your own draft reports.', 403);
    }

    if (existing.status === ReportStatus.SUBMITTED) {
      // Prevent duplicate notification or duplicate submission
      return existing;
    }

    if (existing.status === ReportStatus.APPROVED) {
      throw new AppError('Approved reports cannot be re-submitted.', 400);
    }

    const isRevision = existing.status === ReportStatus.REVISION_REQUESTED;

    const updated = await prisma.dailyWorkReport.update({
      where: { id },
      data: {
        status: ReportStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    await DailyReportService.notifyAdminsForReport(id, isRevision);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    await AuditService.log({
      actorId: userId,
      actorName: user?.fullName,
      actorEmail: user?.email,
      action: 'REPORT_SUBMITTED',
      resourceType: 'DAILY_REPORT',
      resourceId: id,
      ipAddress: meta?.ipAddress,
    });

    return updated;
  }

  /**
   * Review daily work report (Approve, Request Revision, Under Review)
   * Tracks self review explicitly (`isSelfReviewed`)
   */
  static async reviewReport(
    id: string,
    status: ReportStatus,
    reviewerComments: string,
    reviewerId: string,
    meta?: { ipAddress?: string }
  ) {
    const existing = await prisma.dailyWorkReport.findUnique({
      where: { id },
      include: { submittedBy: true },
    });
    if (!existing) {
      throw new AppError('Daily work report not found', 404);
    }

    const isSelfReviewed = existing.submittedById === reviewerId;

    const updated = await prisma.$transaction(async (tx) => {
      const rep = await tx.dailyWorkReport.update({
        where: { id },
        data: {
          status,
          reviewerId,
          reviewerComments,
          reviewedAt: new Date(),
          isSelfReviewed,
        },
      });

      const currentCount = await tx.dailyReportHistory.count({ where: { reportId: id } });
      await tx.dailyReportHistory.create({
        data: {
          reportId: id,
          version: currentCount + 1,
          workDescription: rep.workDescription,
          workCompleted: rep.workCompleted,
          workPending: rep.workPending,
          hoursSpent: rep.hoursSpent,
          status,
          reviewerComments,
          modifiedById: reviewerId,
        },
      });

      // Send in-app notification to report author if reviewer is different
      if (!isSelfReviewed) {
        await tx.notification.create({
          data: {
            userId: existing.submittedById,
            title: status === ReportStatus.APPROVED ? 'Daily Report Approved' : 'Report Revision Requested',
            message: `Your report for ${existing.reportDate.toISOString().slice(0, 10)} was ${status.toLowerCase().replace('_', ' ')}. Feedback: ${reviewerComments}`,
            type: 'REPORT',
            link: `/employee/my-reports?reportId=${existing.id}`,
          },
        });
      }

      return rep;
    });

    const reviewer = await prisma.user.findUnique({ where: { id: reviewerId } });
    await AuditService.log({
      actorId: reviewerId,
      actorName: reviewer?.fullName,
      actorEmail: reviewer?.email,
      action: status === ReportStatus.APPROVED ? 'REPORT_APPROVED' : 'REPORT_REVISION_REQUESTED',
      resourceType: 'DAILY_REPORT',
      resourceId: id,
      beforeState: existing,
      afterState: { ...updated, isSelfReviewed },
      ipAddress: meta?.ipAddress,
    });

    return updated;
  }

  /**
   * Helper to notify active Admin(s) upon daily work report submission
   */
  static async notifyAdminsForReport(reportId: string, isRevision = false) {
    const report = await prisma.dailyWorkReport.findUnique({
      where: { id: reportId },
      include: {
        submittedBy: {
          select: { id: true, fullName: true, email: true },
        },
        client: {
          select: { id: true, companyName: true },
        },
        task: {
          select: { id: true, title: true },
        },
        service: {
          select: { id: true, name: true },
        },
      },
    });

    if (!report) return;

    const activeAdmins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (!activeAdmins.length) return;

    const employeeName = report.submittedBy?.fullName || 'Employee';
    const clientName = report.client?.companyName || 'Assigned Client';

    const contextParts: string[] = [];
    if (report.service?.name) contextParts.push(report.service.name);
    if (report.task?.title) contextParts.push(report.task.title);
    const contextSuffix = contextParts.length > 0 ? ` — ${contextParts.join(' / ')}` : '';

    const title = isRevision
      ? 'Revised Daily Work Report Submitted'
      : 'New Daily Work Report Submitted';
    const message = `${employeeName} submitted a Daily Work Report for ${clientName}${contextSuffix}.`;
    const link = `/admin/daily-reports?reportId=${report.id}`;

    for (const admin of activeAdmins) {
      if (admin.id === report.submittedById) continue;

      // Prevent duplicate notification: check if a notification with this title and link was created within 30 seconds
      const existingNotif = await prisma.notification.findFirst({
        where: {
          userId: admin.id,
          link,
          title,
          type: 'REPORT',
          createdAt: {
            gte: new Date(Date.now() - 30000),
          },
        },
      });

      if (!existingNotif) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            title,
            message,
            type: 'REPORT',
            link,
            isRead: false,
          },
        });
      }
    }
  }
}

