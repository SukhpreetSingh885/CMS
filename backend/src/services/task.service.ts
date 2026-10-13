import fs from 'fs';
import path from 'path';
import { Prisma, TaskStatus, Priority } from '@prisma/client';
import { prisma } from '../config/db.js';
import { AppError, ForbiddenError, NotFoundError } from '../utils/AppError.js';
import { AuditService } from './audit.service.js';
import { buildPrismaDateFilter } from '../utils/dateRange.js';
import { DeliverableProgressService } from './deliverable-progress.service.js';

export interface CreateTaskDto {
  title: string;
  description?: string | null;
  clientId: string;
  serviceId?: string | null;
  assignedToId: string;
  reviewerId?: string | null;
  priority?: Priority;
  startDate?: string | null;
  dueDate: string;
  estimatedHours?: number;
  deliverableCount?: number;
  clientApprovalRequired?: boolean;
  internalNotes?: string | null;
  deliverableId?: string | null;
  deliverableName?: string | null;
}

export class TaskService {
  /**
   * List tasks with filters, search, and dynamic overdue calculation
   */
  static async listTasks(query: {
    clientId?: string;
    assignedToId?: string;
    assignedById?: string;
    reviewerId?: string;
    serviceId?: string;
    priority?: Priority;
    status?: TaskStatus;
    isOverdue?: boolean | string;
    dueDateFrom?: string;
    dueDateTo?: string;
    startDate?: string;
    endDate?: string;
    dateRange?: string;
    minProgress?: number;
    maxProgress?: number;
    search?: string;
    sortBy?: 'dueDate' | 'createdAt' | 'priority' | 'updatedAt' | 'completionPercentage';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10));
    const skip = (page - 1) * pageSize;

    const where: Prisma.TaskWhereInput = {};

    if (query.clientId) where.clientId = query.clientId;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.assignedById) where.assignedById = query.assignedById;
    if (query.reviewerId) where.reviewerId = query.reviewerId;
    if (query.serviceId) where.serviceId = query.serviceId;
    if (query.priority) where.priority = query.priority;
    if (query.status) where.status = query.status;

    const dateFilter = buildPrismaDateFilter({
      dateRange: query.dateRange,
      startDate: query.dueDateFrom || query.startDate,
      endDate: query.dueDateTo || query.endDate,
    });
    if (dateFilter) {
      where.dueDate = { ...dateFilter };
    }

    const isOverdueFilter = query.isOverdue === true || String(query.isOverdue) === 'true';
    if (isOverdueFilter) {
      const now = new Date();
      where.dueDate = {
        ...(typeof where.dueDate === 'object' && where.dueDate !== null ? where.dueDate : {}),
        lt: now,
      };
      if (!where.status) {
        where.status = { notIn: [TaskStatus.APPROVED, TaskStatus.DELIVERED, TaskStatus.COMPLETED] };
      }
    }

    if (query.minProgress !== undefined || query.maxProgress !== undefined) {
      where.completionPercentage = {};
      if (query.minProgress !== undefined && String(query.minProgress) !== '') {
        where.completionPercentage.gte = Number(query.minProgress);
      }
      if (query.maxProgress !== undefined && String(query.maxProgress) !== '') {
        where.completionPercentage.lte = Number(query.maxProgress);
      }
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { description: { contains: query.search } },
        { client: { companyName: { contains: query.search } } },
        { service: { name: { contains: query.search } } },
      ];
    }

    const orderBy: Prisma.TaskOrderByWithRelationInput[] = [];
    if (query.sortBy) {
      const dir = query.sortOrder || 'asc';
      orderBy.push({ [query.sortBy]: dir });
    } else {
      orderBy.push({ dueDate: 'asc' }, { createdAt: 'desc' });
    }

    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          client: { select: { id: true, companyName: true, status: true, industry: true } },
          service: { select: { id: true, name: true, description: true } },
          assignedTo: { select: { id: true, fullName: true, email: true, role: true, designation: true } },
          assignedBy: { select: { id: true, fullName: true, email: true, role: true, designation: true } },
          reviewer: { select: { id: true, fullName: true, email: true, role: true, designation: true } },
          startedBy: { select: { id: true, fullName: true, email: true, role: true, designation: true } },
          comments: {
            where: { isInternal: false },
            orderBy: { createdAt: 'asc' },
            include: {
              user: { select: { id: true, fullName: true, role: true, avatarUrl: true } },
            },
          },
          attachments: {
            orderBy: { createdAt: 'desc' },
            include: {
              uploadedBy: { select: { id: true, fullName: true, email: true, role: true, designation: true } },
            },
          },
          _count: { select: { comments: true, attachments: true } },
        },
      }),
    ]);

    const now = new Date();
    const tasksWithOverdue = tasks.map((t) => {
      const isOverdue =
        t.dueDate < now &&
        !([TaskStatus.APPROVED, TaskStatus.DELIVERED, TaskStatus.COMPLETED] as TaskStatus[]).includes(t.status);

      const meta = DeliverableProgressService.parseTaskDeliverableMeta(t);

      return {
        ...t,
        deliverableId: meta.deliverableId,
        deliverableName: meta.deliverableName,
        internalNotes: meta.cleanNotes,
        isOverdue,
      };
    });

    return { total, page, pageSize, tasks: tasksWithOverdue };
  }

  /**
   * Get single task by ID with comments, attachments, and reviewer information
   */
  static async getTaskById(id: string, user?: { id: string; role: string }) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, companyName: true, contactPerson: true, email: true, mobileNumber: true },
        },
        service: true,
        assignedTo: {
          select: { id: true, fullName: true, email: true, role: true, designation: true, phone: true },
        },
        assignedBy: { select: { id: true, fullName: true, email: true } },
        reviewer: { select: { id: true, fullName: true, email: true } },
        startedBy: { select: { id: true, fullName: true, email: true, role: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, fullName: true, role: true, avatarUrl: true } },
          },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
          include: {
            uploadedBy: { select: { id: true, fullName: true, email: true, role: true, designation: true } },
          },
        },
        _count: {
          select: { comments: true, attachments: true },
        },
      },
    });

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    // Role-based task access check for Employees
    if (user && user.role !== 'ADMIN') {
      const isDirectAssignee = task.assignedToId === user.id;
      const isClientAssignee = !isDirectAssignee
        ? await prisma.clientAssignedEmployee.findUnique({
            where: {
              clientId_userId: {
                clientId: task.clientId,
                userId: user.id,
              },
            },
          })
        : null;

      const isServiceAssignee =
        !isDirectAssignee && !isClientAssignee && prisma.clientService?.findFirst
          ? await prisma.clientService.findFirst({
              where: {
                clientId: task.clientId,
                OR: [
                  { assignedEmployeeId: user.id },
                  { assignedEmployees: { some: { employeeId: user.id, isActive: true } } },
                ],
              },
            })
          : null;

      if (!isDirectAssignee && !isClientAssignee && !isServiceAssignee) {
        throw new ForbiddenError('Access forbidden: You cannot access tasks for this client.');
      }
    }

    const now = new Date();
    const isOverdue =
      task.dueDate < now &&
      !([TaskStatus.APPROVED, TaskStatus.DELIVERED, TaskStatus.COMPLETED] as TaskStatus[]).includes(task.status);

    const meta = DeliverableProgressService.parseTaskDeliverableMeta(task);

    return {
      ...task,
      deliverableId: meta.deliverableId,
      deliverableName: meta.deliverableName,
      internalNotes: meta.cleanNotes,
      isOverdue,
    };
  }

  /**
   * Create task (supports Admin self-assignment or assigning to Employees assigned to the client service)
   */
  static async createTask(dto: CreateTaskDto, creatorId: string, meta?: { ipAddress?: string }) {
    const assignedUser = await prisma.user.findUnique({ where: { id: dto.assignedToId } });
    if (!assignedUser || assignedUser.status !== 'ACTIVE') {
      throw new AppError('Assigned user not found or is inactive.', 400);
    }

    // If assigning to an EMPLOYEE and a serviceId is specified, verify the service is purchased by the client
    // and the employee belongs to that service's team (preserving Admin self-assignment when role === 'ADMIN')
    if (assignedUser.role === 'EMPLOYEE' && dto.serviceId && prisma.clientService?.findFirst) {
      const clientSvc = await prisma.clientService.findFirst({
        where: {
          clientId: dto.clientId,
          serviceId: dto.serviceId,
        },
        include: {
          assignedEmployees: {
            where: { isActive: true },
          },
        },
      });

      if (!clientSvc) {
        throw new AppError('Selected service is not part of this client’s purchased services.', 400);
      }

      const teamIds = new Set<string>(
        [
          ...(clientSvc.assignedEmployeeId ? [clientSvc.assignedEmployeeId] : []),
          ...(clientSvc.assignedEmployees || []).map((ae) => ae.employeeId),
        ].filter(Boolean)
      );

      if (teamIds.size === 0) {
        throw new AppError(
          'No employees assigned to this service. Please assign a service team before creating employee tasks.',
          400
        );
      }

      if (!teamIds.has(dto.assignedToId)) {
        throw new AppError(
          'Selected employee is not assigned to this client service team. Please assign them to the service team first.',
          400
        );
      }
    }

    // Determine isSelfReviewed default
    const isSelfReviewed = dto.reviewerId === dto.assignedToId;

    // Encode deliverable linkage in internalNotes if provided
    const internalNotes = DeliverableProgressService.formatInternalNotesWithMeta(dto.internalNotes, {
      deliverableId: dto.deliverableId,
      deliverableName: dto.deliverableName,
    });

    const task = await prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        clientId: dto.clientId,
        serviceId: dto.serviceId,
        assignedToId: dto.assignedToId,
        assignedById: creatorId,
        reviewerId: dto.reviewerId || creatorId,
        priority: dto.priority || Priority.MEDIUM,
        startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
        startedAt: null,
        startedById: null,
        dueDate: new Date(dto.dueDate),
        estimatedHours: dto.estimatedHours || 0,
        deliverableCount: dto.deliverableCount || 0,
        status: TaskStatus.ASSIGNED,
        completionPercentage: 0,
        clientApprovalRequired: dto.clientApprovalRequired || false,
        isSelfReviewed,
        internalNotes,
      },
      include: {
        client: { select: { id: true, companyName: true } },
        service: true,
        assignedTo: { select: { id: true, fullName: true, email: true, role: true, designation: true } },
        assignedBy: { select: { id: true, fullName: true, email: true } },
        reviewer: { select: { id: true, fullName: true, email: true } },
        startedBy: { select: { id: true, fullName: true, email: true, role: true } },
      },
    });

    // Create in-app notification for the assigned user
    if (dto.assignedToId !== creatorId) {
      await prisma.notification.create({
        data: {
          userId: dto.assignedToId,
          title: 'New Task Assigned',
          message: `You have been assigned task: "${dto.title}" for ${task.client.companyName}`,
          type: 'TASK',
          link: `/employee/my-tasks`,
        },
      });
    }

    const creator = await prisma.user.findUnique({ where: { id: creatorId } });
    await AuditService.log({
      actorId: creatorId,
      actorName: creator?.fullName,
      actorEmail: creator?.email,
      action: 'TASK_CREATED',
      resourceType: 'TASK',
      resourceId: task.id,
      afterState: task,
      ipAddress: meta?.ipAddress,
    });

    const metaParsed = DeliverableProgressService.parseTaskDeliverableMeta(task);
    return {
      ...task,
      deliverableId: metaParsed.deliverableId,
      deliverableName: metaParsed.deliverableName,
      internalNotes: metaParsed.cleanNotes,
    };
  }

  /**
   * Start an assigned task (atomic conditional transition from CREATED/ASSIGNED -> IN_PROGRESS at 0%)
   */
  static async startTask(id: string, actorId: string, meta?: { ipAddress?: string }) {
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Task not found');
    }

    const actor = await prisma.user.findUnique({ where: { id: actorId } });
    if (!actor || actor.status !== 'ACTIVE') {
      throw new ForbiddenError('Unauthorized user.');
    }

    // Only the user explicitly assigned to the task can start it (Employee or self-assigned Admin)
    if (existing.assignedToId !== actorId) {
      throw new ForbiddenError('Access forbidden: Only the employee assigned to this task can start it.');
    }

    // Prevent starting tasks that are under review, approved, delivered, or completed
    if (
      ([
        TaskStatus.INTERNAL_REVIEW,
        TaskStatus.CLIENT_APPROVAL,
        TaskStatus.APPROVED,
        TaskStatus.DELIVERED,
        TaskStatus.COMPLETED,
      ] as TaskStatus[]).includes(existing.status)
    ) {
      throw new AppError(`Cannot start a task that is already in ${existing.status} state.`, 400);
    }

    // Idempotency for repeated clicks: if already started (IN_PROGRESS with startedAt set),
    // preserve original startedAt and do NOT create duplicate start events.
    if (existing.status === TaskStatus.IN_PROGRESS && existing.startedAt !== null) {
      return TaskService.getTaskById(id, { id: actor.id, role: actor.role });
    }

    if (existing.status !== TaskStatus.CREATED && existing.status !== TaskStatus.ASSIGNED) {
      throw new AppError(`Task can only be started from a Not Started / Assigned state (current: ${existing.status}).`, 400);
    }

    const startedAtTimestamp = new Date();

    const txResult = await prisma.$transaction(async (tx) => {
      // Atomic conditional update to prevent race conditions and duplicate start timestamps
      const atomicUpdate = await tx.task.updateMany({
        where: {
          id,
          assignedToId: actorId,
          status: { in: [TaskStatus.CREATED, TaskStatus.ASSIGNED] },
          startedAt: null,
        },
        data: {
          status: TaskStatus.IN_PROGRESS,
          startedAt: startedAtTimestamp,
          startedById: actorId,
          completionPercentage: 0,
        },
      });

      const startedNow = atomicUpdate.count === 1;

      if (startedNow && tx.taskComment?.create) {
        await tx.taskComment.create({
          data: {
            taskId: id,
            userId: actorId,
            content: `${actor.fullName} started working on this task.`,
            isInternal: false,
          },
        });
      }

      const task = await tx.task.findUnique({
        where: { id },
        include: {
          client: { select: { id: true, companyName: true, contactPerson: true } },
          service: true,
          assignedTo: { select: { id: true, fullName: true, email: true, role: true, designation: true } },
          assignedBy: { select: { id: true, fullName: true, email: true } },
          reviewer: { select: { id: true, fullName: true, email: true } },
          startedBy: { select: { id: true, fullName: true, email: true, role: true } },
          comments: {
            where: { isInternal: false },
            orderBy: { createdAt: 'asc' },
            include: {
              user: { select: { id: true, fullName: true, role: true, avatarUrl: true } },
            },
          },
          attachments: {
            orderBy: { createdAt: 'desc' },
            include: {
              uploadedBy: { select: { id: true, fullName: true } },
            },
          },
          _count: {
            select: { comments: true, attachments: true },
          },
        },
      });

      return { startedNow, task: task! };
    });

    if (txResult.startedNow) {
      await AuditService.log({
        actorId,
        actorName: actor.fullName,
        actorEmail: actor.email,
        action: 'TASK_STARTED',
        resourceType: 'TASK',
        resourceId: id,
        beforeState: {
          status: existing.status,
          startedAt: existing.startedAt,
          completionPercentage: existing.completionPercentage,
        },
        afterState: {
          status: TaskStatus.IN_PROGRESS,
          startedAt: txResult.task.startedAt,
          startedById: actorId,
          completionPercentage: 0,
        },
        ipAddress: meta?.ipAddress,
      });
    }

    const now = new Date();
    const isOverdue =
      txResult.task.dueDate < now &&
      !([TaskStatus.APPROVED, TaskStatus.DELIVERED, TaskStatus.COMPLETED] as TaskStatus[]).includes(txResult.task.status);

    const metaParsed = DeliverableProgressService.parseTaskDeliverableMeta(txResult.task);
    return {
      ...txResult.task,
      deliverableId: metaParsed.deliverableId,
      deliverableName: metaParsed.deliverableName,
      internalNotes: metaParsed.cleanNotes,
      isOverdue,
    };
  }

  /**
   * Update task details
   */
  static async updateTask(id: string, data: any, actorId: string, meta?: { ipAddress?: string }) {
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Task not found', 404);
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.serviceId !== undefined) updateData.serviceId = data.serviceId;
    if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId;
    if (data.reviewerId !== undefined) updateData.reviewerId = data.reviewerId;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
    if (data.estimatedHours !== undefined) updateData.estimatedHours = data.estimatedHours;
    if (data.actualHours !== undefined) updateData.actualHours = data.actualHours;
    if (data.clientApprovalRequired !== undefined) updateData.clientApprovalRequired = data.clientApprovalRequired;

    if (data.deliverableId !== undefined || data.deliverableName !== undefined || data.internalNotes !== undefined) {
      const existingMeta = DeliverableProgressService.parseTaskDeliverableMeta(existing);
      const nextDeliverableId = data.deliverableId !== undefined ? data.deliverableId : existingMeta.deliverableId;
      const nextDeliverableName = data.deliverableName !== undefined ? data.deliverableName : existingMeta.deliverableName;
      const nextNotes = data.internalNotes !== undefined ? data.internalNotes : existingMeta.cleanNotes;

      updateData.internalNotes = DeliverableProgressService.formatInternalNotesWithMeta(
        nextNotes,
        { deliverableId: nextDeliverableId, deliverableName: nextDeliverableName }
      );
    } else if (data.internalNotes !== undefined) {
      updateData.internalNotes = data.internalNotes;
    }

    // Check status and completion percentage logic
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === TaskStatus.DELIVERED || data.status === TaskStatus.COMPLETED || data.status === TaskStatus.APPROVED) {
        updateData.completionPercentage = 100;
      }
    }

    if (data.completionPercentage !== undefined && !['DELIVERED', 'COMPLETED', 'APPROVED'].includes(updateData.status || existing.status)) {
      updateData.completionPercentage = data.completionPercentage;
    }

    // Explicit self-review check
    const assignedUser = updateData.assignedToId || existing.assignedToId;
    const reviewerUser = updateData.reviewerId || existing.reviewerId;
    if (reviewerUser && reviewerUser === assignedUser) {
      updateData.isSelfReviewed = true;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id },
        data: updateData,
        include: {
          client: true,
          service: true,
          assignedTo: true,
          assignedBy: { select: { id: true, fullName: true, email: true } },
          reviewer: { select: { id: true, fullName: true, email: true } },
          startedBy: { select: { id: true, fullName: true, email: true, role: true } },
          comments: {
            orderBy: { createdAt: 'asc' },
            include: {
              user: { select: { id: true, fullName: true, role: true, avatarUrl: true } },
            },
          },
          attachments: {
            orderBy: { createdAt: 'desc' },
            include: {
              uploadedBy: { select: { id: true, fullName: true, email: true, role: true, designation: true } },
            },
          },
          _count: {
            select: { comments: true, attachments: true },
          },
        },
      });

      // Track completed deliverables according to the task's configured deliverableCount
      const isNowCompleted = (
        data.status === TaskStatus.COMPLETED ||
        data.status === TaskStatus.DELIVERED ||
        data.status === TaskStatus.APPROVED
      );
      const wasCompleted = (
        existing.status === TaskStatus.COMPLETED ||
        existing.status === TaskStatus.DELIVERED ||
        existing.status === TaskStatus.APPROVED
      );
      const effectiveDeliverables = task.deliverableCount > 0 ? task.deliverableCount : 0;

      if (isNowCompleted && !wasCompleted && task.serviceId && effectiveDeliverables > 0) {
        await tx.clientService.updateMany({
          where: {
            clientId: task.clientId,
            serviceId: task.serviceId,
          },
          data: {
            completedDeliverables: { increment: effectiveDeliverables },
          },
        });
      } else if (!isNowCompleted && wasCompleted && task.serviceId && effectiveDeliverables > 0) {
        await tx.clientService.updateMany({
          where: {
            clientId: task.clientId,
            serviceId: task.serviceId,
          },
          data: {
            completedDeliverables: { decrement: effectiveDeliverables },
          },
        });
      }

      return task;
    });

    const actor = await prisma.user.findUnique({ where: { id: actorId } });
    await AuditService.log({
      actorId,
      actorName: actor?.fullName,
      actorEmail: actor?.email,
      action: 'TASK_UPDATED',
      resourceType: 'TASK',
      resourceId: id,
      beforeState: existing,
      afterState: updated,
      ipAddress: meta?.ipAddress,
    });

    const metaParsed = DeliverableProgressService.parseTaskDeliverableMeta(updated);
    return {
      ...updated,
      deliverableId: metaParsed.deliverableId,
      deliverableName: metaParsed.deliverableName,
      internalNotes: metaParsed.cleanNotes,
    };
  }

  /**
   * Update task progress status by assigned worker (Admin or Employee)
   */
  static async updateTaskStatus(
    id: string,
    data: {
      status: TaskStatus;
      completionPercentage?: number;
      comment?: string;
      actualHours?: number;
    },
    actorId: string,
    meta?: { ipAddress?: string }
  ) {
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Task not found', 404);
    }

    const actor = await prisma.user.findUnique({ where: { id: actorId } });
    if (actor && actor.role !== 'ADMIN' && existing.assignedToId !== actorId && existing.reviewerId !== actorId) {
      throw new ForbiddenError('Access forbidden: You can only update tasks assigned to you.');
    }

    // Rule: Employees cannot update progress on a task before starting it
    const isNotStarted = existing.status === TaskStatus.CREATED || existing.status === TaskStatus.ASSIGNED;
    if (isNotStarted && actor?.role !== 'ADMIN') {
      throw new AppError('Task must be started before updating progress. Please click Start Task first.', 400);
    }
    if (isNotStarted && data.status === TaskStatus.IN_PROGRESS && (data.completionPercentage ?? 0) > 0) {
      throw new AppError('Task must be started at 0% before updating progress milestones.', 400);
    }

    // Rule: Only Admin or assigned Reviewer can approve and mark a task Completed/Approved/Delivered,
    // AND the task must have legitimately reached 100% and been submitted for review first.
    const isCompletionStatus = ([
      TaskStatus.APPROVED,
      TaskStatus.DELIVERED,
      TaskStatus.COMPLETED,
    ] as TaskStatus[]).includes(data.status);

    if (isCompletionStatus) {
      if (actor && actor.role !== 'ADMIN' && existing.reviewerId !== actorId) {
        throw new ForbiddenError('Only Admin or the assigned Reviewer can approve and complete a task.');
      }

      const isSubmittedForReview = ([
        TaskStatus.INTERNAL_REVIEW,
        TaskStatus.CLIENT_APPROVAL,
        TaskStatus.APPROVED,
        TaskStatus.DELIVERED,
        TaskStatus.COMPLETED,
      ] as TaskStatus[]).includes(existing.status);

      if (!isSubmittedForReview || existing.completionPercentage < 100) {
        throw new AppError(
          'Task can only be approved and completed after it has reached 100% progress and been submitted for review.',
          400
        );
      }
    }

    // Rule: Submitting for review requires 100% progress
    const effectiveProgress =
      data.completionPercentage !== undefined ? data.completionPercentage : existing.completionPercentage;
    if (
      (data.status === TaskStatus.INTERNAL_REVIEW || data.status === TaskStatus.CLIENT_APPROVAL) &&
      (isNotStarted || effectiveProgress < 100)
    ) {
      throw new AppError('Task progress must reach 100% before submitting for review.', 400);
    }

    const updateData: any = {
      status: data.status,
    };

    if (isCompletionStatus) {
      updateData.completionPercentage = 100;
    } else if (data.completionPercentage !== undefined) {
      updateData.completionPercentage = data.completionPercentage;
    }

    if (data.actualHours !== undefined) {
      updateData.actualHours = data.actualHours;
    }

    // Check self review if reviewer is marking it approved
    if (existing.reviewerId === actorId && existing.assignedToId === actorId) {
      updateData.isSelfReviewed = true;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (data.comment) {
        await tx.taskComment.create({
          data: {
            taskId: id,
            userId: actorId,
            content: data.comment,
          },
        });
      }

      const task = await tx.task.update({
        where: { id },
        data: updateData,
        include: {
          client: { select: { id: true, companyName: true, contactPerson: true } },
          service: true,
          assignedTo: { select: { id: true, fullName: true, email: true, role: true, designation: true } },
          assignedBy: { select: { id: true, fullName: true, email: true } },
          reviewer: { select: { id: true, fullName: true, email: true } },
          startedBy: { select: { id: true, fullName: true, email: true, role: true } },
          comments: {
            where: { isInternal: false },
            orderBy: { createdAt: 'asc' },
            include: {
              user: { select: { id: true, fullName: true, role: true, avatarUrl: true } },
            },
          },
          attachments: {
            orderBy: { createdAt: 'desc' },
            include: {
              uploadedBy: { select: { id: true, fullName: true, email: true, role: true, designation: true } },
            },
          },
          _count: {
            select: { comments: true, attachments: true },
          },
        },
      });

      // Track completed deliverables according to the task's configured deliverableCount
      const isNowCompleted = (
        data.status === TaskStatus.COMPLETED ||
        data.status === TaskStatus.DELIVERED ||
        data.status === TaskStatus.APPROVED
      );
      const wasCompleted = (
        existing.status === TaskStatus.COMPLETED ||
        existing.status === TaskStatus.DELIVERED ||
        existing.status === TaskStatus.APPROVED
      );
      const effectiveDeliverables = existing.deliverableCount > 0 ? existing.deliverableCount : 0;

      if (isNowCompleted && !wasCompleted && task.serviceId && effectiveDeliverables > 0) {
        await tx.clientService.updateMany({
          where: {
            clientId: task.clientId,
            serviceId: task.serviceId,
          },
          data: {
            completedDeliverables: { increment: effectiveDeliverables },
          },
        });
      } else if (!isNowCompleted && wasCompleted && task.serviceId && effectiveDeliverables > 0) {
        await tx.clientService.updateMany({
          where: {
            clientId: task.clientId,
            serviceId: task.serviceId,
          },
          data: {
            completedDeliverables: { decrement: effectiveDeliverables },
          },
        });
      }

      return task;
    });

    await AuditService.log({
      actorId,
      actorName: actor?.fullName,
      actorEmail: actor?.email,
      action: 'TASK_STATUS_UPDATED',
      resourceType: 'TASK',
      resourceId: id,
      beforeState: { status: existing.status, completion: existing.completionPercentage },
      afterState: { status: updated.status, completion: updated.completionPercentage },
      ipAddress: meta?.ipAddress,
    });

    const now = new Date();
    const isOverdue =
      updated.dueDate < now &&
      !([TaskStatus.APPROVED, TaskStatus.DELIVERED, TaskStatus.COMPLETED] as TaskStatus[]).includes(updated.status);

    const metaParsed = DeliverableProgressService.parseTaskDeliverableMeta(updated);
    return {
      ...updated,
      deliverableId: metaParsed.deliverableId,
      deliverableName: metaParsed.deliverableName,
      internalNotes: metaParsed.cleanNotes,
      isOverdue,
    };
  }

  /**
   * Approve task deliverables (Admin or Reviewer)
   * Enforces 100% completion requirement, review status, deliverable quota checks,
   * atomic updates, idempotency, and audit logging.
   */
  static async approveTaskDeliverables(
    id: string,
    data: {
      approvedQuantity?: number;
      feedback?: string;
      deliverableId?: string;
      allowOverCredit?: boolean;
    },
    actorId: string,
    meta?: { ipAddress?: string }
  ) {
    const existing = await prisma.task.findUnique({
      where: { id },
      include: {
        client: {
          include: {
            package: true,
            services: {
              include: {
                service: true,
              },
            },
          },
        },
        service: true,
      },
    });

    if (!existing) {
      throw new NotFoundError('Task not found');
    }

    const actor = await prisma.user.findUnique({ where: { id: actorId } });
    if (!actor || actor.status !== 'ACTIVE') {
      throw new ForbiddenError('Unauthorized user.');
    }

    // Role check: Only Admin or the assigned Reviewer can approve deliverables
    if (actor.role !== 'ADMIN' && existing.reviewerId !== actorId) {
      throw new ForbiddenError('Access forbidden: Only Admin or the designated reviewer can approve deliverables.');
    }

    // Prerequisite: Task progress must be 100%
    if (existing.completionPercentage < 100) {
      throw new AppError(
        `Task progress is currently ${existing.completionPercentage}%. Task progress must reach 100% and be submitted for review before it can be approved.`,
        400
      );
    }

    // Prerequisite: Task must be submitted for review (or already in an approved/completed state for idempotent updates)
    const allowedReviewStatuses: TaskStatus[] = [
      TaskStatus.INTERNAL_REVIEW,
      TaskStatus.CLIENT_APPROVAL,
      TaskStatus.APPROVED,
      TaskStatus.DELIVERED,
      TaskStatus.COMPLETED,
    ];

    if (!allowedReviewStatuses.includes(existing.status)) {
      throw new AppError(
        `Task is currently in ${existing.status} status. It must be submitted for review (Internal Review or Client Approval) before it can be approved.`,
        400
      );
    }

    // Resolve deliverable linkage
    const parsedMeta = DeliverableProgressService.parseTaskDeliverableMeta(existing);
    const targetDeliverableId = data.deliverableId || parsedMeta.deliverableId;

    const clientService = existing.client?.services?.find(
      (s) => s.serviceId === existing.serviceId
    );

    let matchedItem: any = null;
    let deliverableName = parsedMeta.deliverableName || null;

    if (clientService) {
      const deliverablesList = DeliverableProgressService.extractDeliverablesList({
        ...clientService,
        client: existing.client,
      });

      if (targetDeliverableId) {
        matchedItem = deliverablesList.find((d) => d.id === targetDeliverableId);
      }
      if (!matchedItem && deliverableName) {
        matchedItem = deliverablesList.find(
          (d) => d.name.trim().toLowerCase() === deliverableName!.trim().toLowerCase()
        );
      }
      if (!matchedItem && deliverablesList.length > 0 && !targetDeliverableId) {
        matchedItem = deliverablesList[0];
      }
    }

    // Calculate approved quantity & over-credit safeguard
    let finalApprovedQuantity = 1;
    if (matchedItem) {
      deliverableName = matchedItem.name;
      const targetQty =
        matchedItem.quantity !== null && matchedItem.quantity !== undefined
          ? Math.max(1, matchedItem.quantity)
          : 1;

      // Query other approved tasks for this deliverable to determine previously approved quantity
      const otherApprovedTasks = await prisma.task.findMany({
        where: {
          clientId: existing.clientId,
          serviceId: existing.serviceId,
          id: { not: existing.id },
          status: { in: [TaskStatus.APPROVED, TaskStatus.DELIVERED, TaskStatus.COMPLETED] },
        },
      });

      const previouslyApproved = otherApprovedTasks.reduce((sum, t) => {
        const tMeta = DeliverableProgressService.parseTaskDeliverableMeta(t);
        const matches =
          (tMeta.deliverableId && tMeta.deliverableId === matchedItem.id) ||
          (tMeta.deliverableName &&
            tMeta.deliverableName.trim().toLowerCase() === matchedItem.name.trim().toLowerCase());
        if (matches) {
          return sum + (t.deliverableCount > 0 ? t.deliverableCount : 1);
        }
        return sum;
      }, 0);

      const remainingQuantity = Math.max(0, targetQty - previouslyApproved);

      if (matchedItem.deliverableType === 'FEATURE') {
        finalApprovedQuantity = 1;
      } else if (matchedItem.deliverableType === 'MILESTONE') {
        finalApprovedQuantity = data.approvedQuantity !== undefined ? Number(data.approvedQuantity) : 1;
      } else {
        // QUANTITY type
        if (data.approvedQuantity !== undefined) {
          finalApprovedQuantity = Number(data.approvedQuantity);
        } else if (existing.deliverableCount > 0) {
          finalApprovedQuantity = existing.deliverableCount;
        } else {
          finalApprovedQuantity = remainingQuantity > 0 ? 1 : 1;
        }

        if (finalApprovedQuantity < 0) {
          throw new AppError('Approved quantity cannot be negative.', 400);
        }

        // Prevent over-crediting unless explicitly overridden
        if (previouslyApproved + finalApprovedQuantity > targetQty && !data.allowOverCredit) {
          throw new AppError(
            `Approving ${finalApprovedQuantity} ${matchedItem.unit || 'units'} would exceed the agreed package target of ${targetQty} (already approved: ${previouslyApproved}, remaining: ${remainingQuantity}). Please adjust the quantity or confirm override.`,
            400
          );
        }
      }
    } else {
      // General task without linked deliverable item
      finalApprovedQuantity =
        data.approvedQuantity !== undefined
          ? Number(data.approvedQuantity)
          : existing.deliverableCount || 0;
    }

    // Atomic transaction
    const txResult = await prisma.$transaction(async (tx) => {
      // Format internal notes with confirmed deliverable linkage
      let internalNotes = existing.internalNotes;
      if (matchedItem) {
        internalNotes = DeliverableProgressService.formatInternalNotesWithMeta(existing.internalNotes, {
          deliverableId: matchedItem.id,
          deliverableName: matchedItem.name,
        });
      }

      const task = await tx.task.update({
        where: { id },
        data: {
          status: TaskStatus.COMPLETED,
          completionPercentage: 100,
          deliverableCount: finalApprovedQuantity,
          internalNotes,
        },
        include: {
          client: { select: { id: true, companyName: true, contactPerson: true } },
          service: true,
          assignedTo: { select: { id: true, fullName: true, email: true, role: true, designation: true } },
          reviewer: { select: { id: true, fullName: true, email: true } },
          startedBy: { select: { id: true, fullName: true, email: true, role: true } },
          comments: {
            where: { isInternal: false },
            orderBy: { createdAt: 'asc' },
            include: { user: { select: { id: true, fullName: true, role: true, avatarUrl: true } } },
          },
          attachments: {
            orderBy: { createdAt: 'desc' },
            include: { uploadedBy: { select: { id: true, fullName: true, email: true, role: true, designation: true } } },
          },
          _count: { select: { comments: true, attachments: true } },
        },
      });

      // Add approval comment/activity
      const commentContent = data.feedback?.trim()
        ? data.feedback.trim()
        : matchedItem
        ? `Task approved by Admin (${actor.fullName}). Credited ${finalApprovedQuantity} ${matchedItem.unit || 'units'} towards deliverable: "${matchedItem.name}".`
        : `Task approved and completed by Admin (${actor.fullName}).`;

      await tx.taskComment.create({
        data: {
          taskId: id,
          userId: actorId,
          content: commentContent,
          isInternal: false,
        },
      });

      // Synchronize clientService.completedDeliverables accurately from live approved tasks
      if (task.serviceId) {
        const allApprovedTasks = await tx.task.findMany({
          where: {
            clientId: task.clientId,
            serviceId: task.serviceId,
            status: { in: [TaskStatus.APPROVED, TaskStatus.DELIVERED, TaskStatus.COMPLETED] },
          },
          select: { deliverableCount: true },
        });

        const totalCompleted = allApprovedTasks.reduce(
          (sum, t) => sum + (t.deliverableCount > 0 ? t.deliverableCount : 1),
          0
        );

        await tx.clientService.updateMany({
          where: {
            clientId: task.clientId,
            serviceId: task.serviceId,
          },
          data: {
            completedDeliverables: totalCompleted,
          },
        });
      }

      // Send in-app notification to employee
      if (task.assignedToId && task.assignedToId !== actorId) {
        await tx.notification.create({
          data: {
            userId: task.assignedToId,
            title: 'Task Deliverable Approved',
            message: `Admin approved your task "${task.title}" with ${finalApprovedQuantity} deliverable(s) credited.`,
            type: 'TASK',
            link: `/employee/my-tasks`,
          },
        });
      }

      return task;
    });

    await AuditService.log({
      actorId,
      actorName: actor.fullName,
      actorEmail: actor.email,
      action: 'TASK_DELIVERABLE_APPROVED',
      resourceType: 'TASK',
      resourceId: id,
      beforeState: {
        status: existing.status,
        completion: existing.completionPercentage,
        deliverableCount: existing.deliverableCount,
      },
      afterState: {
        status: txResult.status,
        completion: txResult.completionPercentage,
        deliverableCount: txResult.deliverableCount,
        deliverableName,
        approvedQuantity: finalApprovedQuantity,
      },
      ipAddress: meta?.ipAddress,
    });

    const metaParsed = DeliverableProgressService.parseTaskDeliverableMeta(txResult);
    return {
      ...txResult,
      deliverableId: metaParsed.deliverableId,
      deliverableName: metaParsed.deliverableName,
      internalNotes: metaParsed.cleanNotes,
      approvedDeliverableInfo: matchedItem
        ? {
            id: matchedItem.id,
            name: matchedItem.name,
            creditedQuantity: finalApprovedQuantity,
            unit: matchedItem.unit,
            deliverableType: matchedItem.deliverableType,
          }
        : null,
    };
  }

  /**
   * Request revisions or reject task (Admin or Reviewer)
   * Transitions task back to REVISION_REQUIRED at 90% progress,
   * records mandatory feedback comment, and safely reverses deliverable credits if previously completed.
   */
  static async rejectTask(
    id: string,
    data: { feedback: string },
    actorId: string,
    meta?: { ipAddress?: string }
  ) {
    if (!data.feedback || !data.feedback.trim()) {
      throw new AppError('Feedback is required when requesting task revisions.', 400);
    }

    const existing = await prisma.task.findUnique({
      where: { id },
      include: {
        client: true,
        service: true,
      },
    });

    if (!existing) {
      throw new NotFoundError('Task not found');
    }

    const actor = await prisma.user.findUnique({ where: { id: actorId } });
    if (!actor || actor.status !== 'ACTIVE') {
      throw new ForbiddenError('Unauthorized user.');
    }

    if (actor.role !== 'ADMIN' && existing.reviewerId !== actorId) {
      throw new ForbiddenError('Access forbidden: Only Admin or the designated reviewer can request revisions.');
    }

    const wasCompleted = ([
      TaskStatus.APPROVED,
      TaskStatus.DELIVERED,
      TaskStatus.COMPLETED,
    ] as TaskStatus[]).includes(existing.status);


    const txResult = await prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id },
        data: {
          status: TaskStatus.REVISION_REQUIRED,
          // Set to 90% so employee can adjust deliverables/proof and resubmit at 100%
          completionPercentage: wasCompleted ? 90 : Math.min(existing.completionPercentage, 90),
        },
        include: {
          client: { select: { id: true, companyName: true } },
          service: true,
          assignedTo: { select: { id: true, fullName: true, email: true, role: true, designation: true } },
          reviewer: { select: { id: true, fullName: true, email: true } },
          startedBy: { select: { id: true, fullName: true, email: true, role: true } },
          comments: {
            where: { isInternal: false },
            orderBy: { createdAt: 'asc' },
            include: { user: { select: { id: true, fullName: true, role: true, avatarUrl: true } } },
          },
          attachments: {
            orderBy: { createdAt: 'desc' },
            include: { uploadedBy: { select: { id: true, fullName: true, email: true, role: true, designation: true } } },
          },
          _count: { select: { comments: true, attachments: true } },
        },
      });

      // Create feedback comment
      await tx.taskComment.create({
        data: {
          taskId: id,
          userId: actorId,
          content: `Revision Requested by ${actor.fullName}: ${data.feedback.trim()}`,
          isInternal: false,
        },
      });

      // If it was previously completed, re-sync clientService.completedDeliverables without this task
      if (wasCompleted && task.serviceId) {
        const allApprovedTasks = await tx.task.findMany({
          where: {
            clientId: task.clientId,
            serviceId: task.serviceId,
            status: { in: [TaskStatus.APPROVED, TaskStatus.DELIVERED, TaskStatus.COMPLETED] },
          },
          select: { deliverableCount: true },
        });

        const totalCompleted = allApprovedTasks.reduce(
          (sum, t) => sum + (t.deliverableCount > 0 ? t.deliverableCount : 1),
          0
        );

        await tx.clientService.updateMany({
          where: {
            clientId: task.clientId,
            serviceId: task.serviceId,
          },
          data: {
            completedDeliverables: totalCompleted,
          },
        });
      }

      // Notify employee
      if (task.assignedToId && task.assignedToId !== actorId) {
        await tx.notification.create({
          data: {
            userId: task.assignedToId,
            title: 'Revision Requested on Task',
            message: `Admin requested revisions on "${task.title}": ${data.feedback.trim()}`,
            type: 'TASK',
            link: `/employee/my-tasks`,
          },
        });
      }

      return task;
    });

    await AuditService.log({
      actorId,
      actorName: actor.fullName,
      actorEmail: actor.email,
      action: 'TASK_REVISION_REQUESTED',
      resourceType: 'TASK',
      resourceId: id,
      beforeState: { status: existing.status, completion: existing.completionPercentage },
      afterState: { status: txResult.status, completion: txResult.completionPercentage },
      ipAddress: meta?.ipAddress,
    });

    const metaParsed = DeliverableProgressService.parseTaskDeliverableMeta(txResult);
    return {
      ...txResult,
      deliverableId: metaParsed.deliverableId,
      deliverableName: metaParsed.deliverableName,
      internalNotes: metaParsed.cleanNotes,
    };
  }

  /**
   * Get deliverable review context for a specific task (used by approval queues and task details modal)
   */
  static async getTaskDeliverableReviewContext(id: string, user?: { id: string; role: string }) {
    const task = await TaskService.getTaskById(id, user);

    const clientService = await prisma.clientService.findFirst({
      where: {
        clientId: task.clientId,
        serviceId: task.serviceId || undefined,
      },
      include: {
        client: {
          include: {
            package: true,
          },
        },
      },
    });

    if (!clientService) {
      return {
        task,
        matchedDeliverable: null,
        availableDeliverables: [],
        reviewSummary: null,
      };
    }

    const deliverablesList = DeliverableProgressService.extractDeliverablesList(clientService);
    const meta = DeliverableProgressService.parseTaskDeliverableMeta(task);

    // Other approved tasks for this service
    const otherApprovedTasks = await prisma.task.findMany({
      where: {
        clientId: task.clientId,
        serviceId: task.serviceId,
        id: { not: task.id },
        status: { in: [TaskStatus.APPROVED, TaskStatus.DELIVERED, TaskStatus.COMPLETED] },
      },
      select: { id: true, deliverableCount: true, internalNotes: true },
    });

    const matchedItem =
      deliverablesList.find((item) => {
        if (meta.deliverableId && item.id === meta.deliverableId) return true;
        if (
          meta.deliverableName &&
          item.name.trim().toLowerCase() === meta.deliverableName.trim().toLowerCase()
        )
          return true;
        return false;
      }) || (deliverablesList.length > 0 ? deliverablesList[0] : null);

    let reviewSummary: any = null;
    if (matchedItem) {
      const previouslyApproved = otherApprovedTasks.reduce((sum, t) => {
        const tMeta = DeliverableProgressService.parseTaskDeliverableMeta(t);
        const matches =
          (tMeta.deliverableId && tMeta.deliverableId === matchedItem.id) ||
          (tMeta.deliverableName &&
            tMeta.deliverableName.trim().toLowerCase() === matchedItem.name.trim().toLowerCase());
        if (matches) {
          return sum + (t.deliverableCount > 0 ? t.deliverableCount : 1);
        }
        return sum;
      }, 0);

      const targetQty =
        matchedItem.quantity !== null && matchedItem.quantity !== undefined
          ? Math.max(1, matchedItem.quantity)
          : 1;
      const remainingQty = Math.max(0, targetQty - previouslyApproved);
      const suggestedApprovedQuantity =
        matchedItem.deliverableType === 'FEATURE'
          ? 1
          : task.deliverableCount > 0
          ? task.deliverableCount
          : Math.min(1, remainingQty);

      reviewSummary = {
        deliverableId: matchedItem.id,
        deliverableName: matchedItem.name,
        deliverableType: matchedItem.deliverableType,
        targetQuantity: targetQty,
        unit: matchedItem.unit || 'units',
        targetPeriod: matchedItem.targetPeriod,
        previouslyApproved,
        remainingQuantity: remainingQty,
        suggestedApprovedQuantity,
        isTaskEligibleForApproval:
          task.completionPercentage === 100 &&
          ([TaskStatus.INTERNAL_REVIEW, TaskStatus.CLIENT_APPROVAL] as TaskStatus[]).includes(task.status),
      };
    }

    return {
      task,
      matchedDeliverable: matchedItem,
      availableDeliverables: deliverablesList,
      reviewSummary,
    };
  }


  /**
   * Add comment to task
   */
  static async addComment(
    taskId: string,
    userId: string,
    content: string,
    isInternal = false
  ) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    const comment = await prisma.taskComment.create({
      data: {
        taskId,
        userId,
        content,
        isInternal,
      },
      include: {
        user: { select: { id: true, fullName: true, role: true, avatarUrl: true } },
      },
    });

    return comment;
  }

  /**
   * Attach file to task
   */
  static async addAttachment(
    taskId: string,
    uploadedById: string,
    file: { fileName: string; fileUrl: string; fileType?: string; fileSize?: number }
  ) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    const uploader = await prisma.user.findUnique({ where: { id: uploadedById } });
    if (uploader && uploader.role !== 'ADMIN') {
      // Ensure employee has access to this task
      await TaskService.getTaskById(taskId, { id: uploader.id, role: uploader.role });
    }

    return prisma.taskAttachment.create({
      data: {
        taskId,
        uploadedById,
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        fileType: file.fileType,
        fileSize: file.fileSize,
      },
      include: {
        uploadedBy: { select: { id: true, fullName: true, email: true, role: true, designation: true } },
      },
    });
  }

  /**
   * List attachments for a task with role-based access check
   */
  static async getTaskAttachments(taskId: string, user?: { id: string; role: string }) {
    const task = await TaskService.getTaskById(taskId, user);
    return task.attachments || [];
  }

  /**
   * Verify task access and resolve attachment record + physical file path for View / Download
   */
  static async getTaskAttachmentForAccess(
    taskId: string,
    attachmentId: string,
    user?: { id: string; role: string }
  ) {
    const task = await TaskService.getTaskById(taskId, user);
    const attachment =
      task.attachments?.find((att) => att.id === attachmentId) ||
      (await prisma.taskAttachment.findFirst({
        where: { id: attachmentId, taskId },
        include: {
          uploadedBy: { select: { id: true, fullName: true, email: true, role: true, designation: true } },
        },
      }));

    if (!attachment) {
      throw new NotFoundError('Task attachment not found');
    }

    const storedFilename = path.basename(attachment.fileUrl);
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    const filePath = path.resolve(uploadsDir, storedFilename);

    if (!filePath.startsWith(uploadsDir) || !fs.existsSync(filePath)) {
      throw new NotFoundError('Attachment file not found on server storage');
    }

    return { attachment, filePath };
  }

  /**
   * Safely delete a task (Strictly Admin-only)
   * Checks if task has comments, attachments, or completed status.
   * If task has attachments or comments, requires explicit confirmation text "DELETE".
   * Safely removes physical files on disk, deletes DB records transactionally, and writes audit log.
   */
  static async deleteTask(id: string, actorId: string, meta?: { ipAddress?: string; confirmation?: string }) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, companyName: true } },
        assignedTo: { select: { id: true, fullName: true, email: true } },
        service: { select: { id: true, name: true } },
        comments: true,
        attachments: true,
      },
    });

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    // If task has attachments, comments, or is marked completed/delivered, require explicit confirmation "DELETE"
    const isCompleted = ([
      TaskStatus.COMPLETED,
      TaskStatus.DELIVERED,
      TaskStatus.APPROVED,
    ] as TaskStatus[]).includes(task.status);
    if ((task.attachments.length > 0 || task.comments.length > 0 || isCompleted) && meta?.confirmation !== 'DELETE') {
      throw new AppError(
        `This task has ${task.attachments.length} attachment(s), ${task.comments.length} comment(s), and status '${task.status}'. Please confirm deletion by typing DELETE.`,
        400
      );
    }

    // Clean up physical attachment files on disk
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    for (const att of task.attachments) {
      if (att.fileUrl) {
        const storedFilename = path.basename(att.fileUrl);
        const filePath = path.resolve(uploadsDir, storedFilename);
        if (filePath.startsWith(uploadsDir) && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (err) {
            console.error(`Failed to delete task attachment file at ${filePath}:`, err);
          }
        }
      }
    }

    // Transactionally delete comments, attachments, and the task record
    await prisma.$transaction(async (tx) => {
      await tx.taskComment.deleteMany({ where: { taskId: id } });
      await tx.taskAttachment.deleteMany({ where: { taskId: id } });
      await tx.task.delete({ where: { id } });
    });

    const actor = await prisma.user.findUnique({ where: { id: actorId } });
    await AuditService.log({
      actorId,
      actorName: actor?.fullName,
      actorEmail: actor?.email,
      action: 'TASK_DELETED',
      resourceType: 'TASK',
      resourceId: id,
      beforeState: {
        id: task.id,
        title: task.title,
        client: task.client?.companyName,
        assignedTo: task.assignedTo?.fullName,
        status: task.status,
        progress: task.completionPercentage,
        attachmentsCount: task.attachments.length,
        commentsCount: task.comments.length,
      },
      ipAddress: meta?.ipAddress,
    });

    return {
      id: task.id,
      title: task.title,
      deleted: true,
      attachmentsRemoved: task.attachments.length,
      commentsRemoved: task.comments.length,
    };
  }
}
