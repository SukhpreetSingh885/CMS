import { Prisma, ReportStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { AppError, ForbiddenError, NotFoundError } from '../utils/AppError.js';
import { AuditService } from './audit.service.js';
import { buildPrismaDateFilter } from '../utils/dateRange.js';
import path from 'path';
import fs from 'fs';

export interface CreateDailyReportDto {
  reportDate?: string;
  clientId: string;
  taskId?: string | null;
  serviceId?: string | null;
  workDescription?: string | null;
  workCompleted: string;
  quantity?: number | null;
  unit?: string | null;
  workPending?: string | null;
  hoursSpent?: number | null;
  issuesOrBlockers?: string | null;
  nextAction?: string | null;
  isDraft?: boolean;
}

export class DailyReportService {
  private static _hasQuantityColumn: boolean | null = null;

  /**
   * Dynamically checks whether the quantity & unit columns exist on DailyWorkReport in MySQL.
   * Ensures backwards and forward compatibility before & after the database migration.
   */
  static async getHasQuantityColumn(): Promise<boolean> {
    if (DailyReportService._hasQuantityColumn !== null) {
      return DailyReportService._hasQuantityColumn;
    }
    try {
      const res: any = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as cnt 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'DailyWorkReport' AND COLUMN_NAME = 'quantity'
      `);
      const count = Number(res[0]?.cnt ?? res[0]?.['COUNT(*)'] ?? 0);
      DailyReportService._hasQuantityColumn = count > 0;
    } catch {
      DailyReportService._hasQuantityColumn = false;
    }
    return DailyReportService._hasQuantityColumn;
  }

  /**
   * Normalizes report output, parsing quantity/unit from native columns or deliverable tags.
   */
  static normalizeReport(r: any) {
    if (!r) return r;
    let quantity: number | null = null;
    let unit: string | null = null;

    if (r.quantity !== undefined && r.quantity !== null) {
      quantity = Number(r.quantity);
      unit = r.unit || null;
    } else if (typeof r.workCompleted === 'string') {
      const match = r.workCompleted.match(/^\[(?:Deliverable:\s*)?([0-9.]+)\s*([^\]]*)\]/i);
      if (match) {
        quantity = parseFloat(match[1]);
        unit = match[2]?.trim() || null;
      }
    }

    return {
      ...r,
      quantity,
      unit,
      hoursSpent: Number(r.hoursSpent || 0),
    };
  }

  /**
   * List client work reports with smart filters (client, employee, service, task, status, date)
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

    // Dynamic sorting (default to reportDate desc, createdAt desc)
    const validSortFields = ['reportDate', 'createdAt', 'hoursSpent', 'status'];
    const sortBy = query.sortBy && validSortFields.includes(query.sortBy) ? query.sortBy : 'reportDate';
    const sortOrder: Prisma.SortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.DailyWorkReportOrderByWithRelationInput[] = [
      { [sortBy]: sortOrder },
      { createdAt: 'desc' },
    ];

    const hasCol = await DailyReportService.getHasQuantityColumn();

    const selectFields: any = {
      id: true,
      reportDate: true,
      submittedById: true,
      clientId: true,
      taskId: true,
      serviceId: true,
      workDescription: true,
      workCompleted: true,
      workPending: true,
      hoursSpent: true,
      issuesOrBlockers: true,
      nextAction: true,
      status: true,
      submittedAt: true,
      reviewerId: true,
      reviewerComments: true,
      reviewedAt: true,
      isSelfReviewed: true,
      createdAt: true,
      updatedAt: true,
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
      attachments: {
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: { attachments: true, history: true },
      },
    };

    if (hasCol) {
      selectFields.quantity = true;
      selectFields.unit = true;
    }

    const [total, rawReports] = await Promise.all([
      prisma.dailyWorkReport.count({ where }),
      prisma.dailyWorkReport.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        select: selectFields,
      }),
    ]);

    const reports = rawReports.map((r: any) => DailyReportService.normalizeReport(r));

    return { total, page, pageSize, reports };
  }

  /**
   * Get single report by ID with history and attachments
   */
  static async getReportById(id: string) {
    const hasCol = await DailyReportService.getHasQuantityColumn();

    const selectFields: any = {
      id: true,
      reportDate: true,
      submittedById: true,
      clientId: true,
      taskId: true,
      serviceId: true,
      workDescription: true,
      workCompleted: true,
      workPending: true,
      hoursSpent: true,
      issuesOrBlockers: true,
      nextAction: true,
      status: true,
      submittedAt: true,
      reviewerId: true,
      reviewerComments: true,
      reviewedAt: true,
      isSelfReviewed: true,
      createdAt: true,
      updatedAt: true,
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
      attachments: {
        orderBy: { createdAt: 'desc' },
      },
      history: {
        orderBy: { modifiedAt: 'desc' },
        select: {
          id: true,
          reportId: true,
          version: true,
          workDescription: true,
          workCompleted: true,
          workPending: true,
          hoursSpent: true,
          status: true,
          modifiedById: true,
          modifiedAt: true,
          ...(hasCol ? { quantity: true, unit: true } : {}),
        },
      },
    };

    if (hasCol) {
      selectFields.quantity = true;
      selectFields.unit = true;
    }

    const report = await prisma.dailyWorkReport.findUnique({
      where: { id },
      select: selectFields,
    });

    if (!report) {
      throw new AppError('Client work report not found', 404);
    }

    return DailyReportService.normalizeReport(report);
  }

  /**
   * Create client work report.
   * Supports multiple reports for the same client on the same day without overwriting.
   */
  static async createReport(dto: CreateDailyReportDto, submittedById: string, meta?: { ipAddress?: string }) {
    // 1. Verify client assignment for Employees
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

    // 2. Validate service belongs to client and authorized for employee
    if (dto.serviceId) {
      const clientService = await prisma.clientService.findFirst({
        where: { clientId: dto.clientId, serviceId: dto.serviceId },
        include: { assignedEmployees: true },
      });
      if (!clientService) {
        throw new AppError('The selected service is not part of this client account.', 400);
      }
      if (user && user.role === 'EMPLOYEE') {
        const isAssignedToSvc =
          clientService.assignedEmployeeId === submittedById ||
          (clientService.assignedEmployees || []).some(
            (ae: any) => ae.employeeId === submittedById && ae.isActive
          ) ||
          Boolean(
            await prisma.task.findFirst({
              where: { clientId: dto.clientId, serviceId: dto.serviceId, assignedToId: submittedById },
            })
          );
        if (!isAssignedToSvc) {
          throw new ForbiddenError('You are not assigned to this service for the selected client.');
        }
      }
    }

    // 3. Validate task belongs to client and assigned to employee
    if (dto.taskId) {
      const task = await prisma.task.findUnique({ where: { id: dto.taskId } });
      if (!task || task.clientId !== dto.clientId) {
        throw new AppError('The selected task does not belong to this client.', 400);
      }
      if (user && user.role === 'EMPLOYEE' && task.assignedToId !== submittedById) {
        throw new ForbiddenError('You can only link tasks assigned directly to you.');
      }
    }

    const status = dto.isDraft ? ReportStatus.DRAFT : ReportStatus.SUBMITTED;
    const reportDate = dto.reportDate ? new Date(dto.reportDate) : new Date();

    const rawCompleted = (dto.workCompleted || '').trim();
    const rawDescription = (dto.workDescription || '').trim() || rawCompleted;

    // Fast deduplication: only debounce if the exact same work description was submitted within 2 seconds
    if (!dto.isDraft) {
      const duplicateVeryRecent = await prisma.dailyWorkReport.findFirst({
        where: {
          submittedById,
          clientId: dto.clientId,
          workCompleted: rawCompleted,
          status: ReportStatus.SUBMITTED,
          createdAt: {
            gte: new Date(Date.now() - 2000),
          },
        },
        select: {
          id: true,
          reportDate: true,
          submittedById: true,
          clientId: true,
          workCompleted: true,
          status: true,
          createdAt: true,
        },
      });
      if (duplicateVeryRecent) {
        return DailyReportService.getReportById(duplicateVeryRecent.id);
      }
    }

    const hasCol = await DailyReportService.getHasQuantityColumn();

    // If native column is not yet migrated, prepend deliverable badge tag to workCompleted
    let formattedCompleted = rawCompleted;
    if (!hasCol && dto.quantity !== undefined && dto.quantity !== null && !rawCompleted.startsWith('[')) {
      const unitLabel = dto.unit ? ` ${dto.unit.trim()}` : '';
      formattedCompleted = `[Deliverable: ${dto.quantity}${unitLabel}] ${rawCompleted}`;
    }

    const createData: any = {
      reportDate,
      submittedById,
      clientId: dto.clientId,
      taskId: dto.taskId || null,
      serviceId: dto.serviceId || null,
      workDescription: rawDescription,
      workCompleted: formattedCompleted,
      workPending: dto.workPending || null,
      hoursSpent: dto.hoursSpent !== undefined && dto.hoursSpent !== null ? Number(dto.hoursSpent) : 0,
      issuesOrBlockers: dto.issuesOrBlockers || null,
      nextAction: dto.nextAction || null,
      status,
      submittedAt: dto.isDraft ? null : new Date(),
    };

    if (hasCol && dto.quantity !== undefined && dto.quantity !== null) {
      createData.quantity = Number(dto.quantity);
      createData.unit = dto.unit || null;
    }

    const selectFields: any = {
      id: true,
      reportDate: true,
      submittedById: true,
      clientId: true,
      taskId: true,
      serviceId: true,
      workDescription: true,
      workCompleted: true,
      workPending: true,
      hoursSpent: true,
      issuesOrBlockers: true,
      nextAction: true,
      status: true,
      submittedAt: true,
      reviewerId: true,
      reviewerComments: true,
      reviewedAt: true,
      isSelfReviewed: true,
      createdAt: true,
      updatedAt: true,
      client: true,
      submittedBy: true,
      service: true,
      task: true,
    };

    if (hasCol) {
      selectFields.quantity = true;
      selectFields.unit = true;
    }

    const report: any = await prisma.dailyWorkReport.create({
      data: createData,
      select: selectFields,
    });

    // Create initial history record
    const historyData: any = {
      reportId: report.id,
      version: 1,
      workDescription: rawDescription,
      workCompleted: formattedCompleted,
      workPending: dto.workPending || null,
      hoursSpent: dto.hoursSpent !== undefined && dto.hoursSpent !== null ? Number(dto.hoursSpent) : 0,
      status,
      modifiedById: submittedById,
    };
    if (hasCol && dto.quantity !== undefined && dto.quantity !== null) {
      historyData.quantity = Number(dto.quantity);
      historyData.unit = dto.unit || null;
    }

    try {
      await prisma.dailyReportHistory.create({
        data: historyData,
        select: { id: true },
      });
    } catch {
      // Non-blocking history record
    }

    await AuditService.log({
      actorId: submittedById,
      actorName: report.submittedBy?.fullName,
      actorEmail: report.submittedBy?.email,
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

    return DailyReportService.normalizeReport(report);
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
      throw new AppError('Client work report not found', 404);
    }

    if (userRole !== 'ADMIN' && existing.submittedById !== userId) {
      throw new AppError('You can only edit your own reports.', 403);
    }

    if (existing.status === ReportStatus.APPROVED) {
      throw new AppError('Approved reports cannot be modified.', 400);
    }

    const currentHistoryCount = await prisma.dailyReportHistory.count({ where: { reportId: id } });
    const hasCol = await DailyReportService.getHasQuantityColumn();

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
      if (dto.hoursSpent !== undefined) updateData.hoursSpent = dto.hoursSpent !== null ? Number(dto.hoursSpent) : 0;
      if (dto.issuesOrBlockers !== undefined) updateData.issuesOrBlockers = dto.issuesOrBlockers;
      if (dto.nextAction !== undefined) updateData.nextAction = dto.nextAction;

      if (hasCol) {
        if (dto.quantity !== undefined) updateData.quantity = dto.quantity !== null ? Number(dto.quantity) : null;
        if (dto.unit !== undefined) updateData.unit = dto.unit || null;
      }

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
      const hist: any = {
        reportId: id,
        version: currentHistoryCount + 1,
        workDescription: rep.workDescription,
        workCompleted: rep.workCompleted,
        workPending: rep.workPending,
        hoursSpent: rep.hoursSpent,
        status: rep.status,
        reviewerComments: rep.reviewerComments,
        modifiedById: userId,
      };
      if (hasCol && dto.quantity !== undefined) {
        hist.quantity = dto.quantity !== null ? Number(dto.quantity) : null;
        hist.unit = dto.unit || null;
      }

      try {
        await tx.dailyReportHistory.create({
          data: hist,
        });
      } catch {
        // Non-blocking history record
      }

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

    return DailyReportService.normalizeReport(updated);
  }

  /**
   * Submit a draft report
   */
  static async submitDraft(id: string, userId: string, meta?: { ipAddress?: string }) {
    const existing = await prisma.dailyWorkReport.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Client work report not found', 404);
    }
    if (existing.submittedById !== userId) {
      throw new AppError('You can only submit your own draft reports.', 403);
    }

    if (existing.status === ReportStatus.SUBMITTED) {
      return DailyReportService.normalizeReport(existing);
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

    return DailyReportService.normalizeReport(updated);
  }

  /**
   * Add attachment / proof of work to a report
   */
  static async addAttachment(
    reportId: string,
    file: { fileName: string; fileUrl: string; fileType?: string; fileSize?: number },
    userId: string,
    userRole: string
  ) {
    const report = await prisma.dailyWorkReport.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundError('Report not found');
    }
    if (userRole !== 'ADMIN' && report.submittedById !== userId) {
      throw new ForbiddenError('You can only attach files to your own reports');
    }

    return prisma.dailyReportAttachment.create({
      data: {
        reportId,
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        fileType: file.fileType || null,
        fileSize: file.fileSize || null,
      },
    });
  }

  /**
   * Review daily work report (Optional admin comment/feedback)
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
      throw new AppError('Client work report not found', 404);
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
      try {
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
      } catch {
        // Non-blocking
      }

      // Send in-app notification to report author if reviewer is different
      if (!isSelfReviewed) {
        await tx.notification.create({
          data: {
            userId: existing.submittedById,
            title: status === ReportStatus.APPROVED ? 'Client Report Acknowledged' : 'Report Feedback Added',
            message: `Your report for ${existing.reportDate.toISOString().slice(0, 10)} was updated. Feedback: ${reviewerComments}`,
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

    return DailyReportService.normalizeReport(updated);
  }

  /**
   * Helper to notify active Admin(s) upon client work report submission
   */
  static async notifyAdminsForReport(reportId: string, isRevision = false) {
    const report: any = await DailyReportService.getReportById(reportId);

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
    const cleanCompleted = report.workCompleted.replace(/^\[(?:Deliverable:[^\]]+)\]\s*/, '').slice(0, 80);
    const message = `${employeeName} submitted a Daily Work Report for ${clientName}${contextSuffix}: "${cleanCompleted}".`;
    const link = `/admin/daily-reports?reportId=${report.id}`;

    for (const admin of activeAdmins) {
      if (admin.id === report.submittedById) continue;

      // Prevent duplicate notification: check if a notification with this title and link was created within 5 seconds
      const existingNotif = await prisma.notification.findFirst({
        where: {
          userId: admin.id,
          link,
          title,
          type: 'REPORT',
          createdAt: {
            gte: new Date(Date.now() - 5000),
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
