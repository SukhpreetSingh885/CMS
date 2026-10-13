import { prisma } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { buildPrismaDateFilter } from '../utils/dateRange.js';

export interface CreateAuditLogParams {
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  beforeState?: unknown;
  afterState?: unknown;
  ipAddress?: string;
}

export class AuditService {
  static async log(params: CreateAuditLogParams) {
    try {
      const beforeStr = params.beforeState ? JSON.stringify(params.beforeState) : null;
      const afterStr = params.afterState ? JSON.stringify(params.afterState) : null;

      await prisma.auditLog.create({
        data: {
          actorId: params.actorId,
          actorName: params.actorName,
          actorEmail: params.actorEmail,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId,
          beforeState: beforeStr,
          afterState: afterStr,
          ipAddress: params.ipAddress,
        },
      });
    } catch (error) {
      logger.error('Failed to create audit log entry', error);
      // Non-blocking for primary transaction flow
    }
  }

  static async getLogs(query: {
    page?: number;
    pageSize?: number;
    resourceType?: string;
    action?: string;
    actorId?: string;
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (query.resourceType) where.resourceType = query.resourceType;
    if (query.action) where.action = { contains: query.action };
    if (query.actorId) where.actorId = query.actorId;

    const createdAtFilter = buildPrismaDateFilter({
      dateRange: query.dateRange,
      startDate: query.startDate || query.dateFrom,
      endDate: query.endDate || query.dateTo,
    });
    if (createdAtFilter) {
      where.createdAt = createdAtFilter;
    }

    const [total, items] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: { id: true, fullName: true, email: true, role: true },
          },
        },
      }),
    ]);

    return { total, page, pageSize, items };
  }
}

