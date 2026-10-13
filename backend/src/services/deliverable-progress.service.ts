import { TaskStatus } from '@prisma/client';
import { getDateRangeBoundaries, DateRangeQuery } from '../utils/dateRange.js';

export interface DeliverableConfigItem {
  id: string;
  name: string;
  deliverableType: 'QUANTITY' | 'FEATURE' | 'MILESTONE';
  quantity: number | null;
  unit: string | null;
  targetPeriod:
    | 'ONE_TIME'
    | 'WEEKLY'
    | 'MONTHLY'
    | 'QUARTERLY'
    | 'YEARLY'
    | 'CAMPAIGN_SCOPE'
    | 'MILESTONE_BASED';
  isIncluded?: boolean;
  description?: string | null;
  sortOrder?: number;
}

export interface ItemDeliverableProgress {
  id: string;
  name: string;
  deliverableType: 'QUANTITY' | 'FEATURE' | 'MILESTONE';
  targetQuantity: number;
  approvedQuantity: number;
  unit: string;
  targetPeriod: string;
  progressPercent: number;
  statusText: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  linkedTaskCount: number;
  summaryText: string;
}

export interface ClientServiceDeliverableMetrics {
  clientServiceId: string;
  serviceId: string;
  serviceName: string;
  clientId: string;
  clientName: string;
  clientStatus: string;
  billingCycle: string;
  agreedDeliverablesSummary: string;
  targetPeriodSummary: string;
  items: ItemDeliverableProgress[];
  overallProgressPercent: number;
  totalAgreedItemsCount: number;
  completedAgreedItemsCount: number;
  totalApprovedUnits: number;
  totalTargetUnits: number;
}

const META_DELIVERABLE_REGEX = /\[DELIVERABLE:(\{.*?\})\]/;

export class DeliverableProgressService {
  /**
   * Parse task metadata for deliverable linkage from internalNotes or task properties
   */
  static parseTaskDeliverableMeta(task: any): {
    deliverableId: string | null;
    deliverableName: string | null;
    cleanNotes: string | null;
  } {
    if (!task) {
      return { deliverableId: null, deliverableName: null, cleanNotes: null };
    }

    let deliverableId: string | null = task.deliverableId || null;
    let deliverableName: string | null = task.deliverableName || null;
    let cleanNotes: string | null = task.internalNotes || null;

    if (task.internalNotes && typeof task.internalNotes === 'string') {
      const match = task.internalNotes.match(META_DELIVERABLE_REGEX);
      if (match && match[1]) {
        try {
          const meta = JSON.parse(match[1]);
          if (!deliverableId && meta.deliverableId) deliverableId = meta.deliverableId;
          if (!deliverableName && meta.deliverableName) deliverableName = meta.deliverableName;
          cleanNotes = task.internalNotes.replace(META_DELIVERABLE_REGEX, '').trim() || null;
        } catch {
          // Ignore JSON parse errors
        }
      }
    }

    return { deliverableId, deliverableName, cleanNotes };
  }

  /**
   * Embed deliverable metadata into internalNotes for persistent storage
   */
  static formatInternalNotesWithMeta(
    existingNotes: string | null | undefined,
    meta: { deliverableId?: string | null; deliverableName?: string | null }
  ): string | null {
    const rawNotes = (existingNotes || '').replace(META_DELIVERABLE_REGEX, '').trim();

    if (!meta.deliverableId && !meta.deliverableName) {
      return rawNotes || null;
    }

    const metaTag = `[DELIVERABLE:${JSON.stringify({
      deliverableId: meta.deliverableId || null,
      deliverableName: meta.deliverableName || null,
    })}]`;

    return rawNotes ? `${rawNotes}\n\n${metaTag}` : metaTag;
  }

  /**
   * Extract standardized deliverable items list from ClientService, ContractSnapshot, or Package
   */
  static extractDeliverablesList(clientService: any, packageService?: any): DeliverableConfigItem[] {
    // 1. Check clientService.deliverablesConfig (JSON array)
    if (clientService?.deliverablesConfig && Array.isArray(clientService.deliverablesConfig)) {
      if (clientService.deliverablesConfig.length > 0) {
        return clientService.deliverablesConfig
          .filter((d: any) => d && d.isIncluded !== false)
          .map((d: any, idx: number) => ({
            id: d.id || `deliv_${clientService.id}_${idx}`,
            name: d.name || 'Deliverable Item',
            deliverableType: (d.deliverableType || 'QUANTITY') as any,
            quantity: d.quantity !== undefined && d.quantity !== null ? Number(d.quantity) : (d.deliverableType === 'FEATURE' ? null : 1),
            unit: d.unit || (d.deliverableType === 'QUANTITY' ? 'Units' : ''),
            targetPeriod: (d.targetPeriod || clientService.client?.billingCycle || 'MONTHLY') as any,
            isIncluded: true,
            description: d.description || null,
            sortOrder: d.sortOrder || idx,
          }));
      }
    }

    // 2. Check client.contractSnapshot.services deliverablesList
    if (clientService?.client?.contractSnapshot?.services && Array.isArray(clientService.client.contractSnapshot.services)) {
      const snapSvc = clientService.client.contractSnapshot.services.find(
        (s: any) => s.serviceId === clientService.serviceId
      );
      if (snapSvc?.deliverablesList && Array.isArray(snapSvc.deliverablesList) && snapSvc.deliverablesList.length > 0) {
        return snapSvc.deliverablesList
          .filter((d: any) => d && d.isIncluded !== false)
          .map((d: any, idx: number) => ({
            id: d.id || `snap_${clientService.id}_${idx}`,
            name: d.name || 'Deliverable Item',
            deliverableType: (d.deliverableType || 'QUANTITY') as any,
            quantity: d.quantity !== undefined && d.quantity !== null ? Number(d.quantity) : (d.deliverableType === 'FEATURE' ? null : 1),
            unit: d.unit || (d.deliverableType === 'QUANTITY' ? 'Units' : ''),
            targetPeriod: (d.targetPeriod || clientService.client?.billingCycle || 'MONTHLY') as any,
            isIncluded: true,
            description: d.description || null,
            sortOrder: d.sortOrder || idx,
          }));
      }
    }

    // 3. Check matched PackageService deliverablesList
    if (packageService?.deliverablesList && Array.isArray(packageService.deliverablesList) && packageService.deliverablesList.length > 0) {
      return packageService.deliverablesList
        .filter((d: any) => d && d.isIncluded !== false)
        .map((d: any, idx: number) => ({
          id: d.id || `pkg_${packageService.id}_${idx}`,
          name: d.name || 'Deliverable Item',
          deliverableType: (d.deliverableType || 'QUANTITY') as any,
          quantity: d.quantity !== undefined && d.quantity !== null ? Number(d.quantity) : (d.deliverableType === 'FEATURE' ? null : 1),
          unit: d.unit || (d.deliverableType === 'QUANTITY' ? 'Units' : ''),
          targetPeriod: (d.targetPeriod || clientService?.client?.billingCycle || 'MONTHLY') as any,
          isIncluded: true,
          description: d.description || null,
          sortOrder: d.sortOrder || idx,
        }));
    }

    // 4. Fallback: single standard deliverable item based on monthlyTarget
    const target = clientService?.monthlyTarget || 10;
    return [
      {
        id: `std_${clientService?.id || 'default'}`,
        name: clientService?.deliverables || `${clientService?.service?.name || 'Service'} Scope`,
        deliverableType: 'QUANTITY',
        quantity: target,
        unit: 'deliverables',
        targetPeriod: (clientService?.client?.billingCycle || 'MONTHLY') as any,
        isIncluded: true,
      },
    ];
  }

  /**
   * Determine whether a task's completion falls within the reporting date filter window.
   * Cumulative deliverables (ONE_TIME, CAMPAIGN_SCOPE, MILESTONE_BASED) evaluate cumulatively.
   * Recurring deliverables (WEEKLY, MONTHLY, QUARTERLY, YEARLY) evaluate strictly within the target period.
   */
  static isTaskInPeriod(
    task: any,
    targetPeriod: string,
    filter?: DateRangeQuery
  ): boolean {
    const isCumulative =
      targetPeriod === 'ONE_TIME' ||
      targetPeriod === 'CAMPAIGN_SCOPE' ||
      targetPeriod === 'MILESTONE_BASED';

    const boundary = filter ? getDateRangeBoundaries(filter.dateRange, filter.startDate, filter.endDate) : null;

    // For cumulative deliverables, if no filter or if task was completed up to the filter upper bound, count it!
    if (isCumulative) {
      if (!boundary || !boundary.lte) return true;
      const taskDate = task.completedAt ? new Date(task.completedAt) : new Date(task.updatedAt || task.dueDate);
      return taskDate <= boundary.lte;
    }

    // For recurring deliverables:
    const taskDate = task.completedAt ? new Date(task.completedAt) : new Date(task.updatedAt || task.dueDate);

    if (boundary) {
      if (boundary.gte && taskDate < boundary.gte) return false;
      if (boundary.lte && taskDate > boundary.lte) return false;
      return true;
    }

    // If no boundary filter provided, evaluate within current recurring window
    const now = new Date();
    if (targetPeriod === 'MONTHLY') {
      return (
        taskDate.getFullYear() === now.getFullYear() &&
        taskDate.getMonth() === now.getMonth()
      );
    }

    if (targetPeriod === 'YEARLY') {
      return taskDate.getFullYear() === now.getFullYear();
    }

    if (targetPeriod === 'QUARTERLY') {
      const qNow = Math.floor(now.getMonth() / 3);
      const qTask = Math.floor(taskDate.getMonth() / 3);
      return taskDate.getFullYear() === now.getFullYear() && qNow === qTask;
    }

    if (targetPeriod === 'WEEKLY') {
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      return Math.abs(now.getTime() - taskDate.getTime()) <= oneWeekMs;
    }

    return true;
  }

  /**
   * Check whether a task is legitimately approved/delivered.
   * If clientApprovalRequired is true, task must have status in ['APPROVED', 'DELIVERED', 'COMPLETED'].
   * An in-review or client-approval pending task is NOT approved yet.
   */
  static isTaskApproved(task: any): boolean {
    const approvedStatuses: TaskStatus[] = [
      TaskStatus.APPROVED,
      TaskStatus.DELIVERED,
      TaskStatus.COMPLETED,
    ];
    return approvedStatuses.includes(task.status);
  }

  /**
   * Calculate deliverable progress for a single ClientService and its associated tasks.
   * Follows the equal-weighted item progress formula (Requirement 9),
   * respects deliverable types (QUANTITY, FEATURE, MILESTONE),
   * and separates task progress from deliverable progress.
   */
  static calculateClientServiceMetrics(
    clientService: any,
    tasks: any[],
    filter?: DateRangeQuery
  ): ClientServiceDeliverableMetrics {
    const rawDeliverables = this.extractDeliverablesList(clientService);
    const serviceTasks = tasks.filter((t) => t.serviceId === clientService.serviceId);

    // Map each task to parsed deliverable meta
    const annotatedTasks = serviceTasks.map((t) => {
      const meta = this.parseTaskDeliverableMeta(t);
      return {
        ...t,
        deliverableId: meta.deliverableId,
        deliverableName: meta.deliverableName,
        isApproved: this.isTaskApproved(t),
      };
    });

    const itemMetrics: ItemDeliverableProgress[] = rawDeliverables.map((item) => {
      // Find all tasks linked to this deliverable item
      const linkedTasks = annotatedTasks.filter((t) => {
        if (t.deliverableId && t.deliverableId === item.id) return true;
        if (
          !t.deliverableId &&
          t.deliverableName &&
          t.deliverableName.trim().toLowerCase() === item.name.trim().toLowerCase()
        ) {
          return true;
        }
        return false;
      });

      // Filter linked tasks by target period
      const periodTasks = linkedTasks.filter((t) =>
        this.isTaskInPeriod(t, item.targetPeriod, filter)
      );

      const targetQty = item.quantity !== null && item.quantity !== undefined ? Math.max(1, item.quantity) : 1;
      let approvedQty = 0;
      let progressPercent = 0;
      let statusText: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' = 'NOT_STARTED';

      if (item.deliverableType === 'QUANTITY') {
        approvedQty = periodTasks
          .filter((t) => t.isApproved)
          .reduce((sum, t) => sum + (t.deliverableCount > 0 ? t.deliverableCount : 1), 0);

        progressPercent = Math.min(100, Math.round((approvedQty / targetQty) * 100));

        if (progressPercent >= 100) {
          statusText = 'COMPLETED';
        } else if (progressPercent > 0 || periodTasks.length > 0) {
          statusText = 'IN_PROGRESS';
        } else {
          statusText = 'NOT_STARTED';
        }
      } else if (item.deliverableType === 'FEATURE') {
        const approvedFeature = periodTasks.some((t) => t.isApproved);
        const inProgressFeature = periodTasks.some((t) =>
          [TaskStatus.IN_PROGRESS, TaskStatus.INTERNAL_REVIEW, TaskStatus.CLIENT_APPROVAL].includes(t.status)
        );

        if (approvedFeature) {
          approvedQty = 1;
          progressPercent = 100;
          statusText = 'COMPLETED';
        } else if (inProgressFeature) {
          approvedQty = 0;
          progressPercent = 50;
          statusText = 'IN_PROGRESS';
        } else {
          approvedQty = 0;
          progressPercent = 0;
          statusText = 'NOT_STARTED';
        }
      } else if (item.deliverableType === 'MILESTONE') {
        approvedQty = periodTasks.filter((t) => t.isApproved).length;
        progressPercent = Math.min(100, Math.round((approvedQty / targetQty) * 100));

        if (progressPercent >= 100) {
          statusText = 'COMPLETED';
        } else if (approvedQty > 0 || periodTasks.length > 0) {
          statusText = 'IN_PROGRESS';
        } else {
          statusText = 'NOT_STARTED';
        }
      }

      const summaryText =
        item.deliverableType === 'FEATURE'
          ? `${item.name}: ${statusText === 'COMPLETED' ? 'Approved (100%)' : statusText === 'IN_PROGRESS' ? 'In Progress (50%)' : 'Not Started (0%)'}`
          : `${item.name}: ${approvedQty}/${targetQty} ${item.unit || 'units'} (${progressPercent}%)`;

      return {
        id: item.id,
        name: item.name,
        deliverableType: item.deliverableType,
        targetQuantity: targetQty,
        approvedQuantity: approvedQty,
        unit: item.unit || 'units',
        targetPeriod: item.targetPeriod,
        progressPercent,
        statusText,
        linkedTaskCount: linkedTasks.length,
        summaryText,
      };
    });

    // Equal-weighted average across all agreed deliverable items for this service (Requirement 9)
    const totalItems = itemMetrics.length;
    const overallProgressPercent =
      totalItems > 0
        ? Math.min(
            100,
            Math.round(
              itemMetrics.reduce((sum, item) => sum + item.progressPercent, 0) / totalItems
            )
          )
        : 0;

    const completedAgreedItemsCount = itemMetrics.filter((m) => m.progressPercent >= 100).length;
    const totalApprovedUnits = itemMetrics.reduce((sum, m) => sum + m.approvedQuantity, 0);
    const totalTargetUnits = itemMetrics.reduce((sum, m) => sum + m.targetQuantity, 0);

    const agreedDeliverablesSummary =
      itemMetrics.map((m) => `${m.name} (${m.targetQuantity} ${m.unit})`).join(', ') ||
      clientService.deliverables ||
      'Standard Scope';

    const periodsSet = new Set(itemMetrics.map((m) => m.targetPeriod));
    const targetPeriodSummary = Array.from(periodsSet).join(', ') || clientService.client?.billingCycle || 'MONTHLY';

    return {
      clientServiceId: clientService.id,
      serviceId: clientService.serviceId,
      serviceName: clientService.service?.name || 'Service',
      clientId: clientService.clientId,
      clientName: clientService.client?.companyName || 'Client',
      clientStatus: clientService.client?.status || 'ACTIVE',
      billingCycle: clientService.client?.billingCycle || 'MONTHLY',
      agreedDeliverablesSummary,
      targetPeriodSummary,
      items: itemMetrics,
      overallProgressPercent,
      totalAgreedItemsCount: totalItems,
      completedAgreedItemsCount,
      totalApprovedUnits,
      totalTargetUnits,
    };
  }

  /**
   * Aggregate performance metrics for an entire Service across all client-service assignments and tasks.
   * Satisfies Requirements 1, 9, 10, 11:
   * - Active Clients (non-archived with active service assignments: ACTIVE + ONBOARDING)
   * - Tasks Created
   * - Tasks Completed
   * - Task Completion %
   * - Agreed Deliverables
   * - Approved Deliverable Progress %
   */
  static aggregateServicePerformance(
    service: any,
    filter?: DateRangeQuery
  ): {
    serviceId: string;
    serviceName: string;
    activeClients: number;
    strictlyActiveClients: number;
    onboardingClients: number;
    tasksCreated: number;
    tasksCompleted: number;
    taskCompletionRate: number;
    agreedDeliverables: string;
    targetPeriod: string;
    approvedDeliverableProgress: number;
    deliveryProgress: number;
    completedDeliverables: number;
    totalMonthlyTarget: number;
    deliverablesBreakdown: ItemDeliverableProgress[];
  } {
    // 1. Determine active client services (Requirement 11)
    // Non-archived clients with active clientService assignments
    const activeClientServices = (service.clientServices || []).filter(
      (cs: any) =>
        !cs.client?.isArchived &&
        cs.status === 'ACTIVE' &&
        ['ACTIVE', 'ONBOARDING', 'RENEWAL_DUE', 'RENEWED'].includes(cs.client?.status)
    );

    const activeClients = activeClientServices.length;
    const strictlyActiveClients = activeClientServices.filter((cs: any) => cs.client?.status === 'ACTIVE').length;
    const onboardingClients = activeClientServices.filter((cs: any) => cs.client?.status === 'ONBOARDING').length;

    // 2. Filter tasks for task-count metrics in reporting window (Requirement 7)
    const taskDateBoundary = filter ? getDateRangeBoundaries(filter.dateRange, filter.startDate, filter.endDate) : null;
    const windowTasks = (service.tasks || []).filter((t: any) => {
      if (!taskDateBoundary) return true;
      const tDate = t.dueDate ? new Date(t.dueDate) : new Date(t.createdAt);
      if (taskDateBoundary.gte && tDate < taskDateBoundary.gte) return false;
      if (taskDateBoundary.lte && tDate > taskDateBoundary.lte) return false;
      return true;
    });

    const tasksCreated = windowTasks.length;
    const tasksCompleted = windowTasks.filter((t: any) =>
      [TaskStatus.COMPLETED, TaskStatus.DELIVERED, TaskStatus.APPROVED].includes(t.status)
    ).length;
    const taskCompletionRate = tasksCreated > 0 ? Math.round((tasksCompleted / tasksCreated) * 100) : 0;

    // 3. Calculate deliverable metrics per active client service:
    // Pass full service.tasks so recurring deliverables filter by period
    // while cumulative deliverables (ONE_TIME, CAMPAIGN_SCOPE, MILESTONE_BASED) retain cumulative lifecycle progress
    const clientMetricsList = activeClientServices.map((cs: any) =>
      this.calculateClientServiceMetrics(cs, service.tasks || [], filter)
    );

    // Overall deliverable progress across active clients using this service
    let approvedDeliverableProgress = 0;
    if (clientMetricsList.length > 0) {
      approvedDeliverableProgress = Math.round(
        clientMetricsList.reduce((sum: number, m: ClientServiceDeliverableMetrics) => sum + m.overallProgressPercent, 0) /
          clientMetricsList.length
      );
    }

    // Consolidated deliverables breakdown (taking the active clients' agreed deliverables)
    const consolidatedItemsMap = new Map<string, ItemDeliverableProgress>();
    for (const cm of clientMetricsList) {
      for (const item of cm.items) {
        if (!consolidatedItemsMap.has(item.name)) {
          consolidatedItemsMap.set(item.name, { ...item });
        } else {
          const existing = consolidatedItemsMap.get(item.name)!;
          existing.targetQuantity += item.targetQuantity;
          existing.approvedQuantity += item.approvedQuantity;
          existing.linkedTaskCount += item.linkedTaskCount;
          existing.progressPercent =
            existing.targetQuantity > 0
              ? Math.min(100, Math.round((existing.approvedQuantity / existing.targetQuantity) * 100))
              : 0;
        }
      }
    }

    const deliverablesBreakdown = Array.from(consolidatedItemsMap.values());

    // Summarize agreed deliverables and target period
    const agreedDeliverables =
      deliverablesBreakdown.length > 0
        ? deliverablesBreakdown
            .map((b) => (b.deliverableType === 'FEATURE' ? `${b.name} (Feature)` : `${b.name} (${b.targetQuantity} ${b.unit})`))
            .join('; ')
        : service.defaultMonthlyTarget
        ? `${service.defaultMonthlyTarget} deliverables`
        : 'Standard Scope';

    const periodsSet = new Set<string>();
    deliverablesBreakdown.forEach((b) => periodsSet.add(b.targetPeriod));
    if (periodsSet.size === 0 && service.packageServices) {
      service.packageServices.forEach((ps: any) => {
        (ps.deliverablesList || []).forEach((d: any) => {
          if (d.targetPeriod) periodsSet.add(d.targetPeriod);
        });
      });
    }
    const targetPeriod = Array.from(periodsSet).join(', ') || 'MONTHLY';

    const totalMonthlyTarget = clientMetricsList.reduce((sum: number, m: ClientServiceDeliverableMetrics) => sum + m.totalTargetUnits, 0) ||
      activeClientServices.reduce((sum: number, cs: any) => sum + (cs.monthlyTarget || 0), 0);

    const completedDeliverables = clientMetricsList.reduce((sum: number, m: ClientServiceDeliverableMetrics) => sum + m.totalApprovedUnits, 0);

    return {
      serviceId: service.id,
      serviceName: service.name,
      activeClients,
      strictlyActiveClients,
      onboardingClients,
      tasksCreated,
      tasksCompleted,
      taskCompletionRate,
      agreedDeliverables,
      targetPeriod,
      approvedDeliverableProgress,
      deliveryProgress: approvedDeliverableProgress,
      completedDeliverables,
      totalMonthlyTarget,
      deliverablesBreakdown,
    };
  }
}
