import { prisma } from '../config/db.js';
import { TaskStatus, ReportStatus, ContentStage } from '@prisma/client';
import { DeliverableProgressService } from './deliverable-progress.service.js';

export class ApprovalService {
  /**
   * Centralized pending approvals list across Daily Reports, Tasks, and Content with smart filters
   */
  static async getPendingApprovals(query: {
    type?: 'ALL' | 'TASK' | 'CONTENT' | 'DAILY_REPORT';
    clientId?: string;
    submittedById?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  } = {}) {
    const shouldFetchReports = !query.type || query.type === 'ALL' || query.type === 'DAILY_REPORT';
    const shouldFetchTasks = !query.type || query.type === 'ALL' || query.type === 'TASK';
    const shouldFetchContent = !query.type || query.type === 'ALL' || query.type === 'CONTENT';

    const reportWhere: any = {
      status: query.status ? query.status : { in: [ReportStatus.SUBMITTED, ReportStatus.UNDER_REVIEW] },
    };
    if (query.clientId) reportWhere.clientId = query.clientId;
    if (query.submittedById) reportWhere.submittedById = query.submittedById;
    if (query.startDate || query.endDate) {
      reportWhere.reportDate = {};
      if (query.startDate) reportWhere.reportDate.gte = new Date(query.startDate);
      if (query.endDate) {
        const to = new Date(query.endDate);
        to.setHours(23, 59, 59, 999);
        reportWhere.reportDate.lte = to;
      }
    }

    const taskWhere: any = {
      status: query.status ? query.status : { in: [TaskStatus.INTERNAL_REVIEW, TaskStatus.CLIENT_APPROVAL] },
    };
    if (query.clientId) taskWhere.clientId = query.clientId;
    if (query.submittedById) taskWhere.assignedToId = query.submittedById;

    const contentWhere: any = {
      stage: query.status ? query.status : { in: [ContentStage.INTERNAL_REVIEW, ContentStage.CLIENT_APPROVAL] },
    };
    if (query.clientId) contentWhere.clientId = query.clientId;
    if (query.submittedById) contentWhere.assignedEmployeeId = query.submittedById;

    const [pendingReports, pendingTasks, pendingContent] = await Promise.all([
      // 1. Pending Daily Reports
      shouldFetchReports
        ? prisma.dailyWorkReport.findMany({
            where: reportWhere,
            orderBy: { submittedAt: 'desc' },
            include: {
              submittedBy: {
                select: { id: true, fullName: true, email: true, role: true, designation: true },
              },
              client: { select: { id: true, companyName: true } },
              task: { select: { id: true, title: true } },
              attachments: true,
            },
          })
        : Promise.resolve([]),

      // 2. Pending Tasks (Internal review & Client approval)
      shouldFetchTasks
        ? prisma.task.findMany({
            where: taskWhere,
            orderBy: { updatedAt: 'desc' },
            include: {
              assignedTo: { select: { id: true, fullName: true, email: true, role: true } },
              client: {
                select: {
                  id: true,
                  companyName: true,
                  package: true,
                  contractSnapshot: true,
                  services: {
                    include: {
                      service: true,
                    },
                  },
                },
              },
              service: { select: { id: true, name: true } },
              attachments: {
                orderBy: { createdAt: 'desc' },
                include: {
                  uploadedBy: { select: { id: true, fullName: true } },
                },
              },
              comments: {
                orderBy: { createdAt: 'asc' },
                include: {
                  user: { select: { id: true, fullName: true } },
                },
              },
            },
          })
        : Promise.resolve([]),

      // 3. Pending Content items (Internal review & Client approval)
      shouldFetchContent
        ? prisma.contentItem.findMany({
            where: contentWhere,
            orderBy: { updatedAt: 'desc' },
            include: {
              assignedEmployee: { select: { id: true, fullName: true, email: true } },
              client: { select: { id: true, companyName: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const formattedReports = pendingReports.map((r) => ({
      id: r.id,
      type: 'DAILY_REPORT' as const,
      title: `Daily Report (${r.reportDate.toISOString().slice(0, 10)})`,
      clientName: r.client.companyName,
      clientId: r.clientId,
      submittedByName: r.submittedBy.fullName,
      submittedById: r.submittedBy.id,
      submittedAt: r.submittedAt || r.createdAt,
      status: r.status,
      description: r.workCompleted,
      workPending: r.workPending,
      hoursSpent: Number(r.hoursSpent),
      attachments: r.attachments.map((a) => ({ id: a.id, name: a.fileName, url: a.fileUrl })),
    }));

    const formattedTasks = await Promise.all(
      pendingTasks.map(async (t) => {
        const meta = DeliverableProgressService.parseTaskDeliverableMeta(t);
        const clientSvc = t.client?.services?.find((s: any) => s.serviceId === t.serviceId);
        let deliverableReview: any = null;
        let availableDeliverables: any[] = [];

        if (clientSvc) {
          const deliverablesList = DeliverableProgressService.extractDeliverablesList({
            ...clientSvc,
            client: t.client,
          });

          availableDeliverables = deliverablesList;

          const otherApprovedTasks = await prisma.task.findMany({
            where: {
              clientId: t.clientId,
              serviceId: t.serviceId,
              id: { not: t.id },
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

          if (matchedItem) {
            const previouslyApproved = otherApprovedTasks.reduce((sum, at) => {
              const atMeta = DeliverableProgressService.parseTaskDeliverableMeta(at);
              const matches =
                (atMeta.deliverableId && atMeta.deliverableId === matchedItem.id) ||
                (atMeta.deliverableName &&
                  atMeta.deliverableName.trim().toLowerCase() === matchedItem.name.trim().toLowerCase());
              if (matches) {
                return sum + (at.deliverableCount > 0 ? at.deliverableCount : 1);
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
                : t.deliverableCount > 0
                ? t.deliverableCount
                : Math.min(1, remainingQty);

            deliverableReview = {
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
                t.completionPercentage === 100 &&
                ([TaskStatus.INTERNAL_REVIEW, TaskStatus.CLIENT_APPROVAL] as TaskStatus[]).includes(t.status),
            };
          }
        }

        return {
          id: t.id,
          type: 'TASK' as const,
          title: t.title,
          clientName: t.client.companyName,
          clientId: t.clientId,
          packageName: t.client.package?.name || 'Custom',
          serviceId: t.serviceId,
          serviceName: t.service?.name || 'Service',
          submittedByName: t.assignedTo?.fullName,
          submittedById: t.assignedTo?.id,
          submittedAt: t.updatedAt,
          status: t.status,
          completionPercentage: t.completionPercentage,
          description: meta.cleanNotes || t.description,
          deliverableCount: t.deliverableCount,
          deliverableReview,
          availableDeliverables,
          attachments: t.attachments.map((a: any) => ({
            id: a.id,
            name: a.fileName,
            url: a.fileUrl,
            fileType: a.fileType,
            fileSize: a.fileSize,
            uploadedBy: a.uploadedBy?.fullName,
            createdAt: a.createdAt,
          })),
          comments:
            t.comments?.map((c: any) => ({
              id: c.id,
              content: c.content,
              author: c.user?.fullName,
              createdAt: c.createdAt,
            })) || [],
        };
      })
    );


    const formattedContent = pendingContent.map((c) => ({
      id: c.id,
      type: 'CONTENT' as const,
      title: `${c.contentType} for ${c.platform}: ${c.title}`,
      clientName: c.client.companyName,
      clientId: c.clientId,
      submittedByName: c.assignedEmployee?.fullName || 'Assigned Member',
      submittedById: c.assignedEmployeeId,
      submittedAt: c.updatedAt,
      status: c.stage,
      description: c.caption || c.script || c.notes,
      attachmentUrl: c.attachmentUrl,
    }));

    let allItems = [...formattedReports, ...formattedTasks, ...formattedContent];

    if (query.search) {
      const q = query.search.toLowerCase();
      allItems = allItems.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.clientName?.toLowerCase().includes(q) ||
          item.submittedByName?.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
      );
    }

    allItems.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    return {
      total: allItems.length,
      counts: {
        dailyReports: formattedReports.length,
        tasks: formattedTasks.length,
        content: formattedContent.length,
      },
      items: allItems,
    };
  }
}

