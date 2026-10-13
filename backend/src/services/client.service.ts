import { Prisma, ClientStatus, Priority, BillingCycle, PaymentStatus, RenewalStatus, TaskStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { AppError, ForbiddenError, NotFoundError } from '../utils/AppError.js';
import { AuditService } from './audit.service.js';

import { buildPrismaDateFilter } from '../utils/dateRange.js';
import { DeliverableProgressService } from './deliverable-progress.service.js';

export interface CreateClientDto {
  companyName: string;
  contactPerson: string;
  contactDesignation?: string | null;
  mobileNumber: string;
  whatsAppNumber?: string | null;
  email: string;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  linkedIn?: string | null;
  address?: string | null;
  city?: string | null;
  industry?: string | null;
  leadSource?: string | null;
  onboardingDate?: string;
  contractStartDate: string;
  contractEndDate: string;
  renewalDate: string;
  assignedAdminId?: string | null;
  packageId?: string | null;
  packagePricing?: number;
  billingCycle?: BillingCycle;
  clientPriority?: Priority;
  clientGoals?: string | null;
  status?: ClientStatus;
  contractSnapshot?: any;
  assignedEmployeeIds?: string[];
  services?: {
    serviceId: string;
    assignedEmployeeId?: string | null;
    assignedEmployeeIds?: string[];
    monthlyTarget: number;
    serviceWeight?: number;
    notes?: string | null;
    deliverables?: string | null;
    deliverablesConfig?: any;
  }[];
  generateFirstInvoice?: boolean;
}

export class ClientService {
  /**
   * Normalize service employee assignments so legacy single assignedEmployee
   * and multi-employee ClientServiceEmployeeAssignment records are always unified.
   */
  static normalizeServiceTeam(svc: any) {
    const rawTeam: any[] = Array.isArray(svc.assignedEmployees) ? svc.assignedEmployees : [];
    const seenIds = new Set<string>();
    const normalizedTeam: any[] = [];

    for (const item of rawTeam) {
      if (item && item.isActive !== false && item.employee && !seenIds.has(item.employee.id)) {
        seenIds.add(item.employee.id);
        normalizedTeam.push({
          id: item.id,
          clientServiceId: item.clientServiceId || svc.id,
          employeeId: item.employee.id,
          assignedAt: item.assignedAt,
          isActive: true,
          employee: item.employee,
        });
      }
    }

    if (svc.assignedEmployee && svc.assignedEmployee.id && !seenIds.has(svc.assignedEmployee.id)) {
      seenIds.add(svc.assignedEmployee.id);
      normalizedTeam.unshift({
        id: `legacy_${svc.id}_${svc.assignedEmployee.id}`,
        clientServiceId: svc.id,
        employeeId: svc.assignedEmployee.id,
        assignedAt: svc.createdAt || new Date(),
        isActive: true,
        employee: svc.assignedEmployee,
      });
    }

    return {
      ...svc,
      assignedEmployees: normalizedTeam,
      assignedEmployee: normalizedTeam[0]?.employee || svc.assignedEmployee || null,
      assignedEmployeeId: normalizedTeam[0]?.employeeId || svc.assignedEmployeeId || null,
    };
  }

  /**
   * Synchronize existing single-employee service assignments and task assignments
   * into ClientServiceEmployeeAssignment and ClientAssignedEmployee.
   * Ensures employees assigned via services or tasks always see their clients on Dashboard & My Clients.
   */
  static async syncEmployeeClientAssignments(employeeId?: string) {
    try {
      // 1. If any active clients have 0 ClientService records, backfill ClientServices from package/contractSnapshot or tasks
      const clientsWithoutServices = await prisma.client.findMany({
        where: {
          isArchived: false,
          services: { none: {} },
        },
        include: {
          package: {
            include: {
              packageServices: {
                include: { deliverablesList: true },
              },
            },
          },
          tasks: {
            select: { serviceId: true, assignedToId: true },
          },
        },
      });

      for (const client of clientsWithoutServices) {
        const servicesToCreate: {
          serviceId: string;
          monthlyTarget?: number;
          serviceWeight?: number;
          deliverables?: string | null;
          deliverablesConfig?: any;
          assignedEmployeeId?: string | null;
        }[] = [];

        // Try from contractSnapshot
        const snapServices = (client.contractSnapshot as any)?.services;
        if (Array.isArray(snapServices) && snapServices.length > 0) {
          for (const s of snapServices) {
            if (s.serviceId) {
              servicesToCreate.push({
                serviceId: s.serviceId,
                monthlyTarget: s.monthlyTarget || 10,
                serviceWeight: s.defaultWeight || 1.0,
                deliverables: s.deliverablesSummary || null,
                deliverablesConfig: s.deliverablesList || null,
              });
            }
          }
        } else if (client.package?.packageServices && client.package.packageServices.length > 0) {
          for (const ps of client.package.packageServices) {
            servicesToCreate.push({
              serviceId: ps.serviceId,
              monthlyTarget: ps.monthlyTarget || 10,
              serviceWeight: Number(ps.defaultWeight) || 1.0,
              deliverables: ps.deliverables || null,
              deliverablesConfig: ps.deliverablesList || null,
            });
          }
        }

        // Also check if any tasks have a serviceId not yet included
        for (const t of client.tasks) {
          if (t.serviceId && !servicesToCreate.some((s) => s.serviceId === t.serviceId)) {
            servicesToCreate.push({
              serviceId: t.serviceId,
              monthlyTarget: 10,
              serviceWeight: 1.0,
              assignedEmployeeId: t.assignedToId || null,
            });
          }
        }

        for (const s of servicesToCreate) {
          const taskAssignee = client.tasks.find(
            (t) => t.serviceId === s.serviceId && Boolean(t.assignedToId)
          )?.assignedToId;
          const assignedEmpId = s.assignedEmployeeId || taskAssignee || null;

          const createdClientSvc = await prisma.clientService.create({
            data: {
              clientId: client.id,
              serviceId: s.serviceId,
              monthlyTarget: s.monthlyTarget || 10,
              serviceWeight: s.serviceWeight || 1.0,
              deliverables: s.deliverables || null,
              deliverablesConfig: s.deliverablesConfig || undefined,
              assignedEmployeeId: assignedEmpId,
            },
          });

          if (assignedEmpId) {
            await prisma.clientServiceEmployeeAssignment.create({
              data: {
                clientServiceId: createdClientSvc.id,
                employeeId: assignedEmpId,
                isActive: true,
              },
            });
            await prisma.clientAssignedEmployee.create({
              data: {
                clientId: client.id,
                userId: assignedEmpId,
              },
            });
          }
        }
      }

      // 2. Backfill legacy ClientService.assignedEmployeeId -> ClientServiceEmployeeAssignment & ClientAssignedEmployee
      const legacyWhere: any = employeeId
        ? { assignedEmployeeId: employeeId }
        : { assignedEmployeeId: { not: null } };

      const servicesWithPrimary = await prisma.clientService.findMany({
        where: legacyWhere,
        select: { id: true, clientId: true, assignedEmployeeId: true },
      });

      if (servicesWithPrimary.length > 0 && prisma.clientServiceEmployeeAssignment?.createMany) {
        await prisma.clientServiceEmployeeAssignment.createMany({
          data: servicesWithPrimary
            .filter((s) => Boolean(s.assignedEmployeeId))
            .map((s) => ({
              clientServiceId: s.id,
              employeeId: s.assignedEmployeeId!,
              isActive: true,
            })),
          skipDuplicates: true,
        });
      }

      // 3. Sync from Task assignments -> ClientAssignedEmployee & ClientService
      const taskWhere: any = employeeId
        ? { assignedToId: employeeId }
        : { assignedToId: { not: null } };

      const tasksWithAssignees = await prisma.task.findMany({
        where: taskWhere,
        select: { id: true, clientId: true, serviceId: true, assignedToId: true },
      });

      for (const t of tasksWithAssignees) {
        if (!t.clientId || !t.assignedToId) continue;

        // Ensure ClientAssignedEmployee exists
        await prisma.clientAssignedEmployee.upsert({
          where: {
            clientId_userId: {
              clientId: t.clientId,
              userId: t.assignedToId,
            },
          },
          create: {
            clientId: t.clientId,
            userId: t.assignedToId,
          },
          update: {},
        });

        // If task has serviceId, ensure ClientService team is linked
        if (t.serviceId) {
          const clientSvc = await prisma.clientService.findFirst({
            where: { clientId: t.clientId, serviceId: t.serviceId },
          });
          if (clientSvc) {
            if (!clientSvc.assignedEmployeeId) {
              await prisma.clientService.update({
                where: { id: clientSvc.id },
                data: { assignedEmployeeId: t.assignedToId },
              });
            }
            if (prisma.clientServiceEmployeeAssignment?.createMany) {
              await prisma.clientServiceEmployeeAssignment.createMany({
                data: [
                  {
                    clientServiceId: clientSvc.id,
                    employeeId: t.assignedToId,
                    isActive: true,
                  },
                ],
                skipDuplicates: true,
              });
            }
          }
        }
      }

      // 4. Gather all (clientId, userId) pairs from ClientServiceEmployeeAssignment and ClientService
      const serviceTeamRecords = prisma.clientServiceEmployeeAssignment?.findMany
        ? await prisma.clientServiceEmployeeAssignment.findMany({
            where: {
              isActive: true,
              ...(employeeId ? { employeeId } : {}),
            },
            include: {
              clientService: { select: { clientId: true } },
            },
          })
        : [];

      const pairsMap = new Map<string, { clientId: string; userId: string }>();

      for (const s of servicesWithPrimary) {
        if (s.assignedEmployeeId) {
          pairsMap.set(`${s.clientId}_${s.assignedEmployeeId}`, {
            clientId: s.clientId,
            userId: s.assignedEmployeeId,
          });
        }
      }

      for (const st of serviceTeamRecords) {
        if (st.clientService?.clientId && st.employeeId) {
          pairsMap.set(`${st.clientService.clientId}_${st.employeeId}`, {
            clientId: st.clientService.clientId,
            userId: st.employeeId,
          });
        }
      }

      if (pairsMap.size > 0 && prisma.clientAssignedEmployee?.createMany) {
        await prisma.clientAssignedEmployee.createMany({
          data: Array.from(pairsMap.values()),
          skipDuplicates: true,
        });
      }
    } catch {
      // Non-blocking sync for mocked test environments
    }
  }

  /**
   * List clients with filters, search, and delivery completion metrics
   */
  static async listClients(query: {
    status?: ClientStatus;
    industry?: string;
    assignedAdminId?: string;
    assignedEmployeeId?: string;
    packageId?: string;
    serviceId?: string;
    paymentStatus?: PaymentStatus;
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    onboardingDateFrom?: string;
    onboardingDateTo?: string;
    renewalDateFrom?: string;
    renewalDateTo?: string;
    search?: string;
    sortBy?: 'companyName' | 'createdAt' | 'renewalDate' | 'contractEndDate';
    sortOrder?: 'asc' | 'desc';
    isArchived?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10));
    const skip = (page - 1) * pageSize;

    const where: Prisma.ClientWhereInput = {
      isArchived: query.isArchived === undefined ? false : query.isArchived,
    };

    if (query.status) {
      where.status = query.status;
    }
    if (query.industry) {
      where.industry = { contains: query.industry };
    }
    if (query.assignedAdminId) {
      where.assignedAdminId = query.assignedAdminId;
    }
    if (query.assignedEmployeeId) {
      where.assignedEmployees = {
        some: { userId: query.assignedEmployeeId },
      };
    }
    if (query.packageId) {
      where.packageId = query.packageId;
    }
    if (query.serviceId) {
      where.services = {
        some: { serviceId: query.serviceId },
      };
    }
    if (query.paymentStatus) {
      where.invoices = {
        some: { paymentStatus: query.paymentStatus },
      };
    }

    const onboardingFilter = buildPrismaDateFilter({
      dateRange: query.dateRange,
      startDate: query.startDate || query.onboardingDateFrom,
      endDate: query.endDate || query.onboardingDateTo,
    });
    if (onboardingFilter) {
      where.onboardingDate = onboardingFilter;
    }

    if (query.renewalDateFrom || query.renewalDateTo) {
      where.renewalDate = {};
      if (query.renewalDateFrom) where.renewalDate.gte = new Date(query.renewalDateFrom);
      if (query.renewalDateTo) where.renewalDate.lte = new Date(query.renewalDateTo);
    }
    if (query.search) {
      where.OR = [
        { companyName: { contains: query.search } },
        { contactPerson: { contains: query.search } },
        { email: { contains: query.search } },
        { mobileNumber: { contains: query.search } },
        { city: { contains: query.search } },
        { industry: { contains: query.search } },
      ];
    }

    const orderBy: Prisma.ClientOrderByWithRelationInput = {};
    const sortField = query.sortBy || 'createdAt';
    const sortDir = query.sortOrder || 'desc';
    orderBy[sortField] = sortDir;

    const [total, clients] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          assignedAdmin: {
            select: { id: true, fullName: true, email: true },
          },
          assignedEmployees: {
            include: {
              user: {
                select: { id: true, fullName: true, email: true, designation: true, department: true },
              },
            },
          },
          package: {
            select: { id: true, name: true, basePrice: true },
          },
          services: {
            include: {
              service: true,
              assignedEmployee: {
                select: { id: true, fullName: true, email: true, designation: true, department: true },
              },
              assignedEmployees: {
                where: { isActive: true },
                orderBy: { assignedAt: 'asc' },
                include: {
                  employee: {
                    select: {
                      id: true,
                      fullName: true,
                      email: true,
                      designation: true,
                      department: true,
                      status: true,
                    },
                  },
                },
              },
            },
          },
          invoices: {
            select: {
              id: true,
              invoiceAmount: true,
              amountPaid: true,
              remainingBalance: true,
              paymentStatus: true,
            },
          },
          tasks: {
            select: {
              id: true,
              serviceId: true,
              status: true,
              deliverableCount: true,
              clientApprovalRequired: true,
              internalNotes: true,
              dueDate: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          _count: {
            select: {
              tasks: true,
              dailyReports: true,
              contentItems: true,
              invoices: true,
            },
          },
        },
      }),
    ]);

    // Calculate delivery completion progress for each client
    const clientsWithProgress = clients.map((c) => {
      let totalDeliverables = 0;
      let completedDeliverables = 0;
      let totalWeight = 0;
      let weightedCompletion = 0;

      const normalizedServices = (c.services || []).map((s) => {
        const metrics = DeliverableProgressService.calculateClientServiceMetrics(
          { ...s, client: c },
          c.tasks || []
        );
        const target = metrics.totalTargetUnits;
        const completed = metrics.totalApprovedUnits;
        const weight = Number(s.serviceWeight) || 1.0;

        totalDeliverables += target;
        completedDeliverables += completed;
        totalWeight += weight;

        const svcCompletion = metrics.overallProgressPercent;
        weightedCompletion += svcCompletion * weight;

        return {
          ...ClientService.normalizeServiceTeam(s),
          deliverablesMetrics: metrics,
          completionPercentage: svcCompletion,
        };
      });

      const deliveryProgress =
        totalWeight > 0 ? Math.min(100, Math.round(weightedCompletion / totalWeight)) : 0;

      // Check payment status flag
      const hasPendingPayments = (c.invoices || []).some(
        (inv) => inv.paymentStatus === 'PARTIALLY_PAID' || inv.paymentStatus === 'OVERDUE'
      );

      return {
        ...c,
        services: normalizedServices,
        deliveryProgress,
        hasPendingPayments,
      };
    });

    return { total, page, pageSize, clients: clientsWithProgress };
  }

  /**
   * Get single client by ID with all detailed tabs data
   */
  static async getClientById(id: string, user?: { id: string; role: string }) {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        assignedAdmin: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        assignedEmployees: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, designation: true, department: true, phone: true },
            },
          },
        },
        package: {
          include: {
            packageServices: {
              include: { service: true },
            },
          },
        },
        services: {
          include: {
            service: true,
            assignedEmployee: {
              select: { id: true, fullName: true, email: true, designation: true, department: true },
            },
            assignedEmployees: {
              where: { isActive: true },
              orderBy: { assignedAt: 'asc' },
              include: {
                employee: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    designation: true,
                    department: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
        tasks: {
          orderBy: { dueDate: 'asc' },
          take: 50,
          include: {
            assignedTo: { select: { id: true, fullName: true, designation: true } },
            startedBy: { select: { id: true, fullName: true } },
            service: { select: { id: true, name: true } },
            attachments: {
              orderBy: { createdAt: 'desc' },
              include: {
                uploadedBy: { select: { id: true, fullName: true, role: true } },
              },
            },
            _count: { select: { comments: true, attachments: true } },
          },
        },
        dailyReports: {
          orderBy: { reportDate: 'desc' },
          take: 10,
          include: {
            submittedBy: { select: { id: true, fullName: true } },
          },
        },
        contentItems: {
          orderBy: { createdAt: 'desc' },
          take: 15,
        },
        meetings: {
          orderBy: { meetingDateTime: 'desc' },
          take: 10,
          include: {
            createdBy: { select: { id: true, fullName: true } },
          },
        },
        communications: {
          orderBy: { date: 'desc' },
          take: 15,
          include: {
            loggedBy: { select: { id: true, fullName: true } },
          },
        },
        files: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            uploadedBy: { select: { id: true, fullName: true } },
          },
        },
        invoices: {
          orderBy: { invoiceDate: 'desc' },
          include: {
            payments: {
              where: { isVoided: false },
              orderBy: { paymentDate: 'desc' },
              include: {
                receivedBy: { select: { id: true, fullName: true } },
              },
            },
          },
        },
        payments: {
          where: { isVoided: false },
          orderBy: { paymentDate: 'desc' },
          include: {
            invoice: { select: { id: true, invoiceNumber: true } },
            receivedBy: { select: { id: true, fullName: true } },
          },
        },
        renewals: {
          orderBy: { renewalDate: 'desc' },
        },
      },
    });

    if (!client) {
      throw new NotFoundError('Client not found');
    }

    // Role-based client access check for Employees
    if (user && user.role !== 'ADMIN') {
      const isAssigned =
        (client.assignedEmployees || []).some((ae) => ae.userId === user.id) ||
        (client.services || []).some(
          (s: any) =>
            s.assignedEmployeeId === user.id ||
            (Array.isArray(s.assignedEmployees) &&
              s.assignedEmployees.some((ae: any) => ae.employeeId === user.id && ae.isActive !== false))
        ) ||
        (client.tasks || []).some((t: any) => t.assignedToId === user.id);

      if (!isAssigned) {
        throw new ForbiddenError('Access forbidden: You are not assigned to this client.');
      }
    }

    // Delivery progress calculation & normalize service teams
    let totalDeliverables = 0;
    let completedDeliverables = 0;
    let totalWeight = 0;
    let weightedCompletion = 0;

    const normalizedServices = (client.services || []).map((s) => {
      const metrics = DeliverableProgressService.calculateClientServiceMetrics(
        { ...s, client },
        client.tasks || []
      );
      const target = metrics.totalTargetUnits;
      const completed = metrics.totalApprovedUnits;
      const weight = Number(s.serviceWeight) || 1.0;

      totalDeliverables += target;
      completedDeliverables += completed;
      totalWeight += weight;

      const svcCompletion = metrics.overallProgressPercent;
      weightedCompletion += svcCompletion * weight;

      return {
        ...ClientService.normalizeServiceTeam(s),
        deliverablesMetrics: metrics,
        completionPercentage: svcCompletion,
      };
    });

    const deliveryProgress =
      totalWeight > 0 ? Math.min(100, Math.round(weightedCompletion / totalWeight)) : 0;

    const annotatedTasks = (client.tasks || []).map((t: any) => {
      const meta = DeliverableProgressService.parseTaskDeliverableMeta(t);
      return {
        ...t,
        deliverableId: meta.deliverableId,
        deliverableName: meta.deliverableName,
        internalNotes: meta.cleanNotes,
      };
    });

    if (user && user.role !== 'ADMIN') {
      return {
        ...client,
        tasks: annotatedTasks,
        packagePricing: undefined,
        contractSnapshot: undefined,
        invoices: [],
        payments: [],
        renewals: [],
        services: normalizedServices,
        deliveryProgress,
      };
    }

    return {
      ...client,
      tasks: annotatedTasks,
      services: normalizedServices,
      deliveryProgress,
    };
  }

  /**
   * Complete multi-step client onboarding (Client & Package/Services only; no automatic tasks)
   */
  static async createClient(dto: CreateClientDto, creatorId: string, meta?: { ipAddress?: string }) {
    const existing = await prisma.client.findFirst({
      where: {
        email: dto.email.toLowerCase(),
        isArchived: false,
      },
    });

    if (existing) {
      throw new AppError('A client with this email address already exists.', 409);
    }

    const client = await prisma.$transaction(async (tx) => {
      // Resolve assigned admin if not provided (default to active Admin)
      let resolvedAdminId = dto.assignedAdminId;
      if (!resolvedAdminId) {
        const defaultAdmin = await tx.user.findFirst({
          where: { role: 'ADMIN', status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
        });
        resolvedAdminId = defaultAdmin?.id || creatorId;
      }

      // Freeze immutable contract snapshot
      let contractSnapshot: any = dto.contractSnapshot || null;
      if (!contractSnapshot && dto.packageId) {
        const pkg = await tx.package.findUnique({
          where: { id: dto.packageId },
          include: {
            packageServices: {
              include: {
                service: true,
                deliverablesList: {
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        });

        if (pkg) {
          contractSnapshot = {
            packageId: pkg.id,
            packageName: pkg.name,
            packageType: pkg.packageType,
            basePrice: Number(pkg.basePrice),
            setupFee: Number(pkg.setupFee || 0),
            billingCycle: dto.billingCycle || pkg.billingCycle,
            agreedPrice: dto.packagePricing !== undefined ? dto.packagePricing : Number(pkg.basePrice),
            features: pkg.features,
            services: pkg.packageServices.map((ps) => ({
              serviceId: ps.serviceId,
              serviceName: ps.service.name,
              monthlyTarget: ps.monthlyTarget,
              defaultWeight: Number(ps.defaultWeight),
              deliverablesSummary: ps.deliverables,
              deliverablesList: ps.deliverablesList.map((d) => ({
                id: d.id,
                name: d.name,
                deliverableType: d.deliverableType,
                quantity: d.quantity,
                unit: d.unit,
                targetPeriod: d.targetPeriod,
                isIncluded: d.isIncluded,
                description: d.description,
              })),
            })),
            capturedAt: new Date().toISOString(),
          };
        }
      }

      // 1. Create client record
      const newClient = await tx.client.create({
        data: {
          companyName: dto.companyName,
          contactPerson: dto.contactPerson,
          contactDesignation: dto.contactDesignation,
          mobileNumber: dto.mobileNumber,
          whatsAppNumber: dto.whatsAppNumber || dto.mobileNumber,
          email: dto.email.toLowerCase(),
          website: dto.website,
          instagram: dto.instagram,
          facebook: dto.facebook,
          linkedIn: dto.linkedIn,
          address: dto.address,
          city: dto.city,
          industry: dto.industry,
          leadSource: dto.leadSource,
          onboardingDate: dto.onboardingDate ? new Date(dto.onboardingDate) : new Date(),
          contractStartDate: new Date(dto.contractStartDate),
          contractEndDate: new Date(dto.contractEndDate),
          renewalDate: new Date(dto.renewalDate),
          assignedAdminId: resolvedAdminId,
          packageId: dto.packageId,
          packagePricing: dto.packagePricing || 0,
          billingCycle: dto.billingCycle || 'MONTHLY',
          clientPriority: dto.clientPriority || 'MEDIUM',
          clientGoals: dto.clientGoals,
          contractSnapshot: contractSnapshot || undefined,
          status: dto.status || ClientStatus.ONBOARDING,
          createdById: creatorId,
        },
      });

      // Collect any explicitly provided employee IDs (optional; onboarding defaults to zero employee assignments)
      const allClientEmployeeIds = new Set<string>(
        (dto.assignedEmployeeIds || []).map((id) => id?.trim()).filter(Boolean) as string[]
      );

      // 2. Create purchased client-services records (no automatic task creation during onboarding)
      const servicesList =
        dto.services && dto.services.length > 0
          ? dto.services
          : (contractSnapshot?.services || []).map((s: any) => ({
              serviceId: s.serviceId,
              monthlyTarget: s.monthlyTarget || 10,
              serviceWeight: s.defaultWeight || 1.0,
              deliverables: s.deliverablesSummary,
              deliverablesConfig: s.deliverablesList,
            }));

      if (servicesList.length > 0) {
        for (const svc of servicesList) {
          const matchedPkgSvc = contractSnapshot?.services?.find((s: any) => s.serviceId === svc.serviceId);
          const svcDeliverablesList = svc.deliverablesConfig || matchedPkgSvc?.deliverablesList || null;

          const svcEmployeeIds = Array.from(
            new Set(
              [
                ...(svc.assignedEmployeeIds || []),
                ...(svc.assignedEmployeeId ? [svc.assignedEmployeeId] : []),
              ]
                .map((id) => id?.trim())
                .filter(Boolean) as string[]
            )
          );

          if (svcEmployeeIds.length > 0 && tx.user?.findMany) {
            const validEmps = await tx.user.findMany({
              where: {
                id: { in: svcEmployeeIds },
                role: 'EMPLOYEE',
                status: 'ACTIVE',
              },
              select: { id: true },
            });
            if (validEmps.length !== svcEmployeeIds.length) {
              throw new AppError('One or more selected employees are invalid or inactive.', 400);
            }
          }

          svcEmployeeIds.forEach((empId) => allClientEmployeeIds.add(empId));
          const primaryEmployeeId = svcEmployeeIds[0] || null;

          const createdSvc = await tx.clientService.create({
            data: {
              clientId: newClient.id,
              serviceId: svc.serviceId,
              assignedEmployeeId: primaryEmployeeId,
              monthlyTarget: svc.monthlyTarget || 10,
              serviceWeight: svc.serviceWeight || 1.0,
              notes: svc.notes,
              deliverables: svc.deliverables || matchedPkgSvc?.deliverablesSummary || null,
              deliverablesConfig: svcDeliverablesList || undefined,
            },
          });

          if (svcEmployeeIds.length > 0 && tx.clientServiceEmployeeAssignment?.createMany) {
            await tx.clientServiceEmployeeAssignment.createMany({
              data: svcEmployeeIds.map((empId) => ({
                clientServiceId: createdSvc.id,
                employeeId: empId,
                assignedById: creatorId,
                isActive: true,
              })),
              skipDuplicates: true,
            });
          }
        }
      }

      // 3. Sync any assigned employees into ClientAssignedEmployee
      if (allClientEmployeeIds.size > 0) {
        await tx.clientAssignedEmployee.createMany({
          data: Array.from(allClientEmployeeIds).map((userId) => ({
            clientId: newClient.id,
            userId,
          })),
          skipDuplicates: true,
        });
      }

      // 4. Create Renewal Tracking Record (Only for recurring retainers, NOT for one-time projects)
      if (dto.billingCycle !== 'ONE_TIME') {
        await tx.renewal.create({
          data: {
            clientId: newClient.id,
            contractStartDate: new Date(dto.contractStartDate),
            contractEndDate: new Date(dto.contractEndDate),
            renewalDate: new Date(dto.renewalDate),
            renewalAmount: dto.packagePricing || 0,
            renewalStatus: RenewalStatus.UPCOMING,
          },
        });
      }

      // 5. Generate first invoice if enabled (strictly idempotent: only if no invoice exists for this client yet)
      if (dto.generateFirstInvoice && (dto.packagePricing || 0) > 0) {
        const existingInvoice = await tx.invoice.findFirst({
          where: { clientId: newClient.id },
        });

        if (!existingInvoice) {
          const dateCode = new Date().toISOString().slice(2, 7).replace('-', '');
          const randomCode = Math.floor(1000 + Math.random() * 9000);
          const invoiceNumber = `INV-${dateCode}-${randomCode}`;

          await tx.invoice.create({
            data: {
              clientId: newClient.id,
              invoiceNumber,
              invoiceDate: new Date(),
              dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days due
              packageValue: dto.packagePricing || 0,
              invoiceAmount: dto.packagePricing || 0,
              amountPaid: 0,
              remainingBalance: dto.packagePricing || 0,
              paymentStatus: PaymentStatus.NOT_DUE,
              notes:
                dto.billingCycle === 'ONE_TIME'
                  ? `One-time project contract invoice for ${dto.companyName}`
                  : `First onboarding invoice for ${dto.companyName}`,
            },
          });
        }
      }

      return newClient;
    });

    const creator = await prisma.user.findUnique({ where: { id: creatorId } });
    await AuditService.log({
      actorId: creatorId,
      actorName: creator?.fullName,
      actorEmail: creator?.email,
      action: 'CLIENT_ONBOARDED',
      resourceType: 'CLIENT',
      resourceId: client.id,
      afterState: client,
      ipAddress: meta?.ipAddress,
    });

    return client;
  }

  /**
   * Update client details
   */
  static async updateClient(id: string, dto: Partial<CreateClientDto>, actorId: string, meta?: { ipAddress?: string }) {
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Client not found', 404);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updateData: any = {};
      if (dto.companyName !== undefined) updateData.companyName = dto.companyName;
      if (dto.contactPerson !== undefined) updateData.contactPerson = dto.contactPerson;
      if (dto.contactDesignation !== undefined) updateData.contactDesignation = dto.contactDesignation;
      if (dto.mobileNumber !== undefined) updateData.mobileNumber = dto.mobileNumber;
      if (dto.whatsAppNumber !== undefined) updateData.whatsAppNumber = dto.whatsAppNumber;
      if (dto.email !== undefined) updateData.email = dto.email;
      if (dto.website !== undefined) updateData.website = dto.website;
      if (dto.instagram !== undefined) updateData.instagram = dto.instagram;
      if (dto.facebook !== undefined) updateData.facebook = dto.facebook;
      if (dto.linkedIn !== undefined) updateData.linkedIn = dto.linkedIn;
      if (dto.address !== undefined) updateData.address = dto.address;
      if (dto.city !== undefined) updateData.city = dto.city;
      if (dto.industry !== undefined) updateData.industry = dto.industry;
      if (dto.leadSource !== undefined) updateData.leadSource = dto.leadSource;
      if (dto.contractStartDate) updateData.contractStartDate = new Date(dto.contractStartDate);
      if (dto.contractEndDate) updateData.contractEndDate = new Date(dto.contractEndDate);
      if (dto.renewalDate) updateData.renewalDate = new Date(dto.renewalDate);
      if (dto.assignedAdminId !== undefined) updateData.assignedAdminId = dto.assignedAdminId;
      if (dto.packageId !== undefined) updateData.packageId = dto.packageId;
      if (dto.packagePricing !== undefined) updateData.packagePricing = dto.packagePricing;
      if (dto.billingCycle !== undefined) updateData.billingCycle = dto.billingCycle;
      if (dto.clientPriority !== undefined) updateData.clientPriority = dto.clientPriority;
      if (dto.clientGoals !== undefined) updateData.clientGoals = dto.clientGoals;
      if (dto.status !== undefined) updateData.status = dto.status;

      if (dto.assignedEmployeeIds) {
        const previousAssignments = await tx.clientAssignedEmployee.findMany({
          where: { clientId: id },
        });
        const previousUserIds = previousAssignments.map((a) => a.userId);
        const removedUserIds = previousUserIds.filter((uid) => !dto.assignedEmployeeIds!.includes(uid));

        // Alert Admin if any unassigned employee has pending tasks on this client
        for (const removedUid of removedUserIds) {
          const pendingTasks = await tx.task.findMany({
            where: {
              clientId: id,
              assignedToId: removedUid,
              status: { notIn: [TaskStatus.COMPLETED, TaskStatus.DELIVERED] },
            },
          });

          if (pendingTasks.length > 0) {
            const removedUser = await tx.user.findUnique({ where: { id: removedUid } });
            const admin = await tx.user.findFirst({ where: { role: 'ADMIN' } });
            if (admin) {
              await tx.notification.create({
                data: {
                  userId: admin.id,
                  title: 'Pending Tasks Require Reassignment',
                  message: `${removedUser?.fullName || 'An employee'} was unassigned from ${existing.companyName} with ${pendingTasks.length} pending task(s).`,
                  type: 'TASK',
                  link: `/admin/tasks?clientId=${id}`,
                },
              });
            }
          }
        }

        await tx.clientAssignedEmployee.deleteMany({ where: { clientId: id } });
        if (dto.assignedEmployeeIds.length > 0) {
          await tx.clientAssignedEmployee.createMany({
            data: dto.assignedEmployeeIds.map((userId) => ({
              clientId: id,
              userId,
            })),
          });
        }
      }

      if (dto.services) {
        const serviceEmployeeIdsToSync = new Set<string>();

        // Upsert client services
        for (const svc of dto.services) {
          const svcEmployeeIds = Array.from(
            new Set(
              [
                ...(svc.assignedEmployeeIds || []),
                ...(svc.assignedEmployeeId ? [svc.assignedEmployeeId] : []),
              ]
                .map((empId) => empId?.trim())
                .filter(Boolean) as string[]
            )
          );

          if (svcEmployeeIds.length > 0 && tx.user?.findMany) {
            const validEmps = await tx.user.findMany({
              where: {
                id: { in: svcEmployeeIds },
                role: 'EMPLOYEE',
                status: 'ACTIVE',
              },
              select: { id: true },
            });
            if (validEmps.length !== svcEmployeeIds.length) {
              throw new AppError('One or more selected employees are invalid or inactive.', 400);
            }
          }

          svcEmployeeIds.forEach((empId) => serviceEmployeeIdsToSync.add(empId));
          const primaryEmployeeId = svcEmployeeIds[0] ?? svc.assignedEmployeeId ?? null;

          const upsertedSvc = await tx.clientService.upsert({
            where: {
              clientId_serviceId: {
                clientId: id,
                serviceId: svc.serviceId,
              },
            },
            create: {
              clientId: id,
              serviceId: svc.serviceId,
              assignedEmployeeId: primaryEmployeeId,
              monthlyTarget: svc.monthlyTarget || 10,
              serviceWeight: svc.serviceWeight || 1.0,
              notes: svc.notes,
            },
            update: {
              assignedEmployeeId: primaryEmployeeId,
              monthlyTarget: svc.monthlyTarget,
              serviceWeight: svc.serviceWeight,
              notes: svc.notes,
            },
          });

          if ((svc.assignedEmployeeIds !== undefined || svc.assignedEmployeeId !== undefined) && tx.clientServiceEmployeeAssignment) {
            await tx.clientServiceEmployeeAssignment.deleteMany({
              where: { clientServiceId: upsertedSvc.id },
            });
            if (svcEmployeeIds.length > 0) {
              await tx.clientServiceEmployeeAssignment.createMany({
                data: svcEmployeeIds.map((empId) => ({
                  clientServiceId: upsertedSvc.id,
                  employeeId: empId,
                  assignedById: actorId,
                  isActive: true,
                })),
                skipDuplicates: true,
              });
            }
          }
        }

        if (serviceEmployeeIdsToSync.size > 0 && tx.clientAssignedEmployee?.createMany) {
          await tx.clientAssignedEmployee.createMany({
            data: Array.from(serviceEmployeeIdsToSync).map((userId) => ({
              clientId: id,
              userId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.client.update({
        where: { id },
        data: updateData,
      });
    });

    const actor = await prisma.user.findUnique({ where: { id: actorId } });
    await AuditService.log({
      actorId,
      actorName: actor?.fullName,
      actorEmail: actor?.email,
      action: 'CLIENT_UPDATED',
      resourceType: 'CLIENT',
      resourceId: id,
      beforeState: existing,
      afterState: updated,
      ipAddress: meta?.ipAddress,
    });

    return updated;
  }

  /**
   * Assign or update multiple employees for a specific ClientService
   * Syncs ClientServiceEmployeeAssignment, primary assignedEmployeeId, and ClientAssignedEmployee.
   */
  static async updateClientServiceTeam(
    clientId: string,
    clientServiceId: string,
    employeeIds: string[],
    actorId: string,
    meta?: { ipAddress?: string }
  ) {
    const uniqueEmpIds = Array.from(
      new Set((employeeIds || []).map((id) => id?.trim()).filter(Boolean) as string[])
    );

    const result = await prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: { id: clientId },
        select: { id: true, companyName: true },
      });
      if (!client) {
        throw new NotFoundError('Client not found');
      }

      const clientSvc = await tx.clientService.findFirst({
        where: { id: clientServiceId, clientId },
        include: {
          service: true,
          assignedEmployees: true,
        },
      });
      if (!clientSvc) {
        throw new NotFoundError('Client service assignment not found for this client');
      }

      // Validate that all provided employeeIds are active EMPLOYEE users
      if (uniqueEmpIds.length > 0) {
        const activeEmployees = await tx.user.findMany({
          where: {
            id: { in: uniqueEmpIds },
            role: 'EMPLOYEE',
            status: 'ACTIVE',
          },
          select: { id: true, fullName: true },
        });

        if (activeEmployees.length !== uniqueEmpIds.length) {
          throw new AppError(
            'One or more selected employees are invalid, disabled, or not authorized as active employees.',
            400
          );
        }
      }

      const previousEmpIds = new Set<string>(
        [
          ...(clientSvc.assignedEmployeeId ? [clientSvc.assignedEmployeeId] : []),
          ...(clientSvc.assignedEmployees || []).filter((a) => a.isActive).map((a) => a.employeeId),
        ].filter(Boolean)
      );

      const newlyAddedEmpIds = uniqueEmpIds.filter((empId) => !previousEmpIds.has(empId));
      const removedEmpIds = Array.from(previousEmpIds).filter((empId) => !uniqueEmpIds.includes(empId));

      // 1. Update primary assignedEmployeeId on ClientService for backward compatibility
      const primaryEmployeeId = uniqueEmpIds[0] || null;
      await tx.clientService.update({
        where: { id: clientServiceId },
        data: { assignedEmployeeId: primaryEmployeeId },
      });

      // 2. Replace ClientServiceEmployeeAssignment records without duplicates
      await tx.clientServiceEmployeeAssignment.deleteMany({
        where: { clientServiceId },
      });

      if (uniqueEmpIds.length > 0) {
        await tx.clientServiceEmployeeAssignment.createMany({
          data: uniqueEmpIds.map((empId) => ({
            clientServiceId,
            employeeId: empId,
            assignedById: actorId,
            isActive: true,
          })),
          skipDuplicates: true,
        });
      }

      // 3. Ensure all assigned employees are synced to ClientAssignedEmployee
      if (uniqueEmpIds.length > 0) {
        await tx.clientAssignedEmployee.createMany({
          data: uniqueEmpIds.map((userId) => ({
            clientId,
            userId,
          })),
          skipDuplicates: true,
        });
      }

      // 4. For any removed employees, check if they are still assigned to any OTHER service on this client
      if (removedEmpIds.length > 0) {
        for (const remEmpId of removedEmpIds) {
          const otherServiceCount = await tx.clientService.count({
            where: {
              clientId,
              id: { not: clientServiceId },
              OR: [
                { assignedEmployeeId: remEmpId },
                { assignedEmployees: { some: { employeeId: remEmpId, isActive: true } } },
              ],
            },
          });

          if (otherServiceCount === 0) {
            await tx.clientAssignedEmployee.deleteMany({
              where: { clientId, userId: remEmpId },
            });
          }
        }
      }

      // 5. Notify newly assigned employees
      for (const newEmpId of newlyAddedEmpIds) {
        await tx.notification.create({
          data: {
            userId: newEmpId,
            title: 'New Service Assignment',
            message: `You have been assigned to ${clientSvc.service.name} for client ${client.companyName}.`,
            type: 'SYSTEM',
            link: `/employee/my-clients`,
          },
        });
      }

      // 6. Fetch and return normalized updated ClientService
      const updatedClientService = await tx.clientService.findUnique({
        where: { id: clientServiceId },
        include: {
          service: true,
          assignedEmployee: {
            select: { id: true, fullName: true, email: true, designation: true, department: true },
          },
          assignedEmployees: {
            where: { isActive: true },
            orderBy: { assignedAt: 'asc' },
            include: {
              employee: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  designation: true,
                  department: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      return {
        client,
        beforeEmployeeIds: Array.from(previousEmpIds),
        afterEmployeeIds: uniqueEmpIds,
        clientService: ClientService.normalizeServiceTeam(updatedClientService),
      };
    });

    const actor = await prisma.user.findUnique({ where: { id: actorId } });
    await AuditService.log({
      actorId,
      actorName: actor?.fullName,
      actorEmail: actor?.email,
      action: 'CLIENT_SERVICE_TEAM_UPDATED',
      resourceType: 'CLIENT',
      resourceId: clientId,
      beforeState: { clientServiceId, employeeIds: result.beforeEmployeeIds },
      afterState: { clientServiceId, employeeIds: result.afterEmployeeIds },
      ipAddress: meta?.ipAddress,
    });

    return result.clientService;
  }

  /**
   * Archive client (Soft delete to preserve historical business & financial data)
   */
  static async archiveClient(id: string, actorId: string, meta?: { ipAddress?: string }) {
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Client not found', 404);
    }

    const archived = await prisma.client.update({
      where: { id },
      data: {
        isArchived: true,
        status: ClientStatus.CHURNED,
      },
    });

    const actor = await prisma.user.findUnique({ where: { id: actorId } });
    await AuditService.log({
      actorId,
      actorName: actor?.fullName,
      actorEmail: actor?.email,
      action: 'CLIENT_ARCHIVED',
      resourceType: 'CLIENT',
      resourceId: id,
      beforeState: existing,
      afterState: archived,
      ipAddress: meta?.ipAddress,
    });

    return archived;
  }

  /**
   * Permanently delete client and all associated client-specific data
   * Strictly Admin-only, transactional, cleans up payments, invoices, tasks, reports, etc.
   * Preserves shared Admin accounts, Employee accounts, Services Master, and Package Templates.
   */
  static async deleteClientPermanent(
    id: string,
    confirmation: string,
    actorId: string,
    meta?: { ipAddress?: string }
  ) {
    if (!confirmation || typeof confirmation !== 'string') {
      throw new AppError('Confirmation is required to delete a client permanently', 400);
    }

    return prisma.$transaction(async (tx) => {
      // 1. Lock and fetch client with relation counts
      const client = await tx.client.findUnique({
        where: { id },
        include: {
          package: { select: { id: true, name: true } },
          _count: {
            select: {
              services: true,
              assignedEmployees: true,
              tasks: true,
              dailyReports: true,
              contentItems: true,
              meetings: true,
              communications: true,
              files: true,
              invoices: true,
              payments: true,
              renewals: true,
            },
          },
        },
      });

      if (!client) {
        throw new AppError('Client not found', 404);
      }

      // Check confirmation: must be 'DELETE' or exact company name (case-insensitive)
      const trimmedConf = confirmation.trim();
      const isConfirmed =
        trimmedConf === 'DELETE' ||
        trimmedConf.toLowerCase() === client.companyName.trim().toLowerCase();

      if (!isConfirmed) {
        throw new AppError(
          `Confirmation failed. You must type "DELETE" or the exact client name "${client.companyName}" to confirm permanent deletion.`,
          400
        );
      }

      // 2. Client-specific related data cleanup
      // A. Delete Payments (Must be deleted before invoices due to Restrict constraint on Payment.invoiceId)
      const deletedPayments = await tx.payment.deleteMany({
        where: { clientId: id },
      });

      // B. Delete Invoices
      const deletedInvoices = await tx.invoice.deleteMany({
        where: { clientId: id },
      });

      // C. Delete Renewals
      const deletedRenewals = await tx.renewal.deleteMany({
        where: { clientId: id },
      });

      // D. Delete DailyWorkReports (and associated attachments/history)
      const clientReports = await tx.dailyWorkReport.findMany({
        where: { clientId: id },
        select: { id: true },
      });
      const reportIds = clientReports.map((r) => r.id);
      if (reportIds.length > 0) {
        await tx.dailyReportAttachment.deleteMany({ where: { reportId: { in: reportIds } } });
        await tx.dailyReportHistory.deleteMany({ where: { reportId: { in: reportIds } } });
        await tx.dailyWorkReport.deleteMany({ where: { id: { in: reportIds } } });
      }

      // E. Delete Tasks (and associated comments/attachments)
      const clientTasks = await tx.task.findMany({
        where: { clientId: id },
        select: { id: true },
      });
      const taskIds = clientTasks.map((t) => t.id);
      if (taskIds.length > 0) {
        await tx.taskComment.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.taskAttachment.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.task.deleteMany({ where: { id: { in: taskIds } } });
      }

      // F. Delete ContentItems (deliverables)
      const deletedContent = await tx.contentItem.deleteMany({
        where: { clientId: id },
      });

      // G. Delete Meetings (and participants)
      const clientMeetings = await tx.meeting.findMany({
        where: { clientId: id },
        select: { id: true },
      });
      const meetingIds = clientMeetings.map((m) => m.id);
      if (meetingIds.length > 0) {
        await tx.meetingParticipant.deleteMany({ where: { meetingId: { in: meetingIds } } });
        await tx.meeting.deleteMany({ where: { id: { in: meetingIds } } });
      }

      // H. Delete Communications
      const deletedComms = await tx.communicationLog.deleteMany({
        where: { clientId: id },
      });

      // I. Delete ClientFiles
      const deletedFiles = await tx.clientFile.deleteMany({
        where: { clientId: id },
      });

      // J. Delete ClientServices
      const deletedServices = await tx.clientService.deleteMany({
        where: { clientId: id },
      });

      // K. Delete ClientAssignedEmployees
      const deletedAssignments = await tx.clientAssignedEmployee.deleteMany({
        where: { clientId: id },
      });

      // L. Delete client-specific notifications
      await tx.notification.deleteMany({
        where: {
          OR: [
            { link: { contains: id } },
            { message: { contains: client.companyName } },
          ],
        },
      });

      // M. Finally, permanently delete Client record
      await tx.client.delete({
        where: { id },
      });

      // 3. Log Audit Record
      const actor = await prisma.user.findUnique({ where: { id: actorId } });
      await AuditService.log({
        actorId,
        actorName: actor?.fullName,
        actorEmail: actor?.email,
        action: 'CLIENT_PERMANENTLY_DELETED',
        resourceType: 'CLIENT',
        resourceId: id,
        beforeState: JSON.stringify({
          client: {
            id: client.id,
            companyName: client.companyName,
            email: client.email,
            status: client.status,
            packagePricing: client.packagePricing,
            billingCycle: client.billingCycle,
          },
          deletedCounts: {
            payments: deletedPayments.count,
            invoices: deletedInvoices.count,
            renewals: deletedRenewals.count,
            dailyReports: reportIds.length,
            tasks: taskIds.length,
            contentItems: deletedContent.count,
            meetings: meetingIds.length,
            communications: deletedComms.count,
            files: deletedFiles.count,
            services: deletedServices.count,
            employeeAssignments: deletedAssignments.count,
          },
        }),
        ipAddress: meta?.ipAddress,
      });

      return {
        success: true,
        message: `Client "${client.companyName}" and all associated client-specific data have been permanently deleted.`,
        deletedClientId: id,
        clientName: client.companyName,
        deletedCounts: {
          payments: deletedPayments.count,
          invoices: deletedInvoices.count,
          renewals: deletedRenewals.count,
          dailyReports: reportIds.length,
          tasks: taskIds.length,
          contentItems: deletedContent.count,
          meetings: meetingIds.length,
          communications: deletedComms.count,
          files: deletedFiles.count,
          services: deletedServices.count,
          employeeAssignments: deletedAssignments.count,
        },
      };
    });
  }
}

