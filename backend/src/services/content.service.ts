import { Prisma, ContentPlatform, ContentType, ContentStage } from '@prisma/client';
import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.middleware.js';
import { AuditService } from './audit.service.js';

export interface CreateContentDto {
  clientId: string;
  title: string;
  platform?: ContentPlatform;
  contentType?: ContentType;
  assignedEmployeeId?: string | null;
  stage?: ContentStage;
  shootDate?: string | null;
  editingDate?: string | null;
  approvalDate?: string | null;
  publishingDate?: string | null;
  caption?: string | null;
  script?: string | null;
  attachmentUrl?: string | null;
  notes?: string | null;
}

export class ContentService {
  static async listContent(query: {
    clientId?: string;
    stage?: ContentStage;
    platform?: ContentPlatform;
    assignedEmployeeId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.ContentItemWhereInput = {};

    if (query.clientId) where.clientId = query.clientId;
    if (query.stage) where.stage = query.stage;
    if (query.platform) where.platform = query.platform;
    if (query.assignedEmployeeId) where.assignedEmployeeId = query.assignedEmployeeId;

    if (query.startDate || query.endDate) {
      where.publishingDate = {};
      if (query.startDate) where.publishingDate.gte = new Date(query.startDate);
      if (query.endDate) where.publishingDate.lte = new Date(query.endDate);
    }

    const [total, items] = await Promise.all([
      prisma.contentItem.count({ where }),
      prisma.contentItem.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ publishingDate: 'asc' }, { createdAt: 'desc' }],
        include: {
          client: { select: { id: true, companyName: true } },
          assignedEmployee: { select: { id: true, fullName: true, email: true } },
        },
      }),
    ]);

    return { total, page, pageSize, items };
  }

  static async getContentById(id: string) {
    const item = await prisma.contentItem.findUnique({
      where: { id },
      include: {
        client: true,
        assignedEmployee: true,
      },
    });
    if (!item) {
      throw new AppError('Content item not found', 404);
    }
    return item;
  }

  static async createContent(dto: CreateContentDto, creatorId: string, meta?: { ipAddress?: string }) {
    const item = await prisma.contentItem.create({
      data: {
        clientId: dto.clientId,
        title: dto.title,
        platform: dto.platform || 'INSTAGRAM',
        contentType: dto.contentType || 'REEL',
        assignedEmployeeId: dto.assignedEmployeeId,
        stage: dto.stage || 'IDEA',
        shootDate: dto.shootDate ? new Date(dto.shootDate) : null,
        editingDate: dto.editingDate ? new Date(dto.editingDate) : null,
        approvalDate: dto.approvalDate ? new Date(dto.approvalDate) : null,
        publishingDate: dto.publishingDate ? new Date(dto.publishingDate) : null,
        caption: dto.caption,
        script: dto.script,
        attachmentUrl: dto.attachmentUrl,
        notes: dto.notes,
      },
      include: {
        client: true,
        assignedEmployee: true,
      },
    });

    const creator = await prisma.user.findUnique({ where: { id: creatorId } });
    await AuditService.log({
      actorId: creatorId,
      actorName: creator?.fullName,
      actorEmail: creator?.email,
      action: 'CONTENT_CREATED',
      resourceType: 'CONTENT',
      resourceId: item.id,
      afterState: item,
      ipAddress: meta?.ipAddress,
    });

    return item;
  }

  static async updateContent(id: string, dto: Partial<CreateContentDto>, actorId: string, meta?: { ipAddress?: string }) {
    const existing = await prisma.contentItem.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Content item not found', 404);
    }

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.platform !== undefined) updateData.platform = dto.platform;
    if (dto.contentType !== undefined) updateData.contentType = dto.contentType;
    if (dto.assignedEmployeeId !== undefined) updateData.assignedEmployeeId = dto.assignedEmployeeId;
    if (dto.stage !== undefined) updateData.stage = dto.stage;
    if (dto.shootDate !== undefined) updateData.shootDate = dto.shootDate ? new Date(dto.shootDate) : null;
    if (dto.editingDate !== undefined) updateData.editingDate = dto.editingDate ? new Date(dto.editingDate) : null;
    if (dto.approvalDate !== undefined) updateData.approvalDate = dto.approvalDate ? new Date(dto.approvalDate) : null;
    if (dto.publishingDate !== undefined) updateData.publishingDate = dto.publishingDate ? new Date(dto.publishingDate) : null;
    if (dto.caption !== undefined) updateData.caption = dto.caption;
    if (dto.script !== undefined) updateData.script = dto.script;
    if (dto.attachmentUrl !== undefined) updateData.attachmentUrl = dto.attachmentUrl;
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    const updated = await prisma.contentItem.update({
      where: { id },
      data: updateData,
      include: {
        client: true,
        assignedEmployee: true,
      },
    });

    const actor = await prisma.user.findUnique({ where: { id: actorId } });
    await AuditService.log({
      actorId,
      actorName: actor?.fullName,
      actorEmail: actor?.email,
      action: 'CONTENT_UPDATED',
      resourceType: 'CONTENT',
      resourceId: id,
      beforeState: existing,
      afterState: updated,
      ipAddress: meta?.ipAddress,
    });

    return updated;
  }
}

