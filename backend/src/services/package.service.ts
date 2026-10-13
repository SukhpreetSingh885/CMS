import { prisma } from '../config/db.js';
import { BillingCycle, PackageType, DeliverableType, DeliverablePeriod } from '@prisma/client';
import { AppError } from '../middlewares/error.middleware.js';

export interface PackageDeliverableInput {
  id?: string;
  name: string;
  deliverableType?: DeliverableType;
  quantity?: number | null;
  unit?: string | null;
  targetPeriod?: DeliverablePeriod;
  isIncluded?: boolean;
  description?: string | null;
  sortOrder?: number;
}

export interface PackageServiceInput {
  serviceId: string;
  monthlyTarget?: number;
  defaultWeight?: number;
  deliverables?: string | null;
  deliverablesList?: PackageDeliverableInput[];
}

export interface CreatePackageDTO {
  name: string;
  packageType?: PackageType;
  description?: string | null;
  basePrice: number;
  setupFee?: number;
  billingCycle?: BillingCycle;
  features?: string[];
  services?: PackageServiceInput[];
}

export interface UpdatePackageDTO {
  name?: string;
  packageType?: PackageType;
  description?: string | null;
  basePrice?: number;
  setupFee?: number;
  billingCycle?: BillingCycle;
  features?: string[];
  isActive?: boolean;
  isArchived?: boolean;
  services?: PackageServiceInput[];
}

export class PackageService {
  static async listPackages(filters?: { isArchived?: boolean; includeArchived?: boolean }) {
    const where: any = {};
    if (!filters?.includeArchived) {
      if (filters?.isArchived !== undefined) {
        where.isArchived = filters.isArchived;
      } else {
        where.isArchived = false;
      }
    }

    return prisma.package.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        packageServices: {
          include: {
            service: true,
            deliverablesList: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        _count: {
          select: { clients: true },
        },
      },
    });
  }

  static async getPackageById(id: string) {
    const pkg = await prisma.package.findUnique({
      where: { id },
      include: {
        packageServices: {
          include: {
            service: true,
            deliverablesList: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        _count: {
          select: { clients: true },
        },
      },
    });
    if (!pkg) {
      throw new AppError('Package not found', 404);
    }
    return pkg;
  }

  static async createPackage(data: CreatePackageDTO) {
    const existing = await prisma.package.findUnique({ where: { name: data.name } });
    if (existing) {
      throw new AppError('A package with this name already exists.', 409);
    }

    const calculatedType: PackageType =
      data.packageType ||
      (data.services && data.services.length >= 2
        ? PackageType.COMBINED_BUSINESS
        : PackageType.SINGLE_SERVICE);

    return prisma.$transaction(async (tx) => {
      const pkg = await tx.package.create({
        data: {
          name: data.name,
          packageType: calculatedType,
          description: data.description,
          basePrice: data.basePrice,
          setupFee: data.setupFee !== undefined ? data.setupFee : 0,
          billingCycle: data.billingCycle || BillingCycle.MONTHLY,
          features: data.features || [],
          isActive: true,
          isArchived: false,
        },
      });

      if (data.services && data.services.length > 0) {
        for (const s of data.services) {
          let summary = s.deliverables;
          let calculatedTarget = s.monthlyTarget;

          if (s.deliverablesList && s.deliverablesList.length > 0) {
            if (!summary) {
              summary = s.deliverablesList
                .map((d) => {
                  if (d.deliverableType === DeliverableType.FEATURE) {
                    return `${d.name}: ${d.isIncluded !== false ? 'Included' : 'Excluded'}`;
                  }
                  return `${d.name}: ${d.quantity ?? 1} ${d.unit || ''}`.trim();
                })
                .join(', ');
            }
            if (!calculatedTarget) {
              calculatedTarget = s.deliverablesList
                .filter((d) => d.deliverableType !== DeliverableType.FEATURE)
                .reduce((acc, curr) => acc + (curr.quantity || 1), 0);
              if (calculatedTarget === 0) calculatedTarget = 1;
            }
          }

          const createdPackageService = await tx.packageService.create({
            data: {
              packageId: pkg.id,
              serviceId: s.serviceId,
              monthlyTarget: calculatedTarget ?? 10,
              defaultWeight: s.defaultWeight ?? 1.0,
              deliverables: summary || null,
            },
          });

          if (s.deliverablesList && s.deliverablesList.length > 0) {
            const defaultPeriod =
              (data.billingCycle || BillingCycle.MONTHLY) === BillingCycle.ONE_TIME
                ? DeliverablePeriod.ONE_TIME
                : DeliverablePeriod.MONTHLY;

            await tx.packageDeliverable.createMany({
              data: s.deliverablesList.map((d, index) => {
                const delivType = d.deliverableType || DeliverableType.QUANTITY;
                return {
                  packageServiceId: createdPackageService.id,
                  name: d.name,
                  deliverableType: delivType,
                  quantity: delivType === DeliverableType.FEATURE ? null : (d.quantity !== undefined ? d.quantity : 1),
                  unit: delivType === DeliverableType.FEATURE ? null : (d.unit || 'unit'),
                  targetPeriod: d.targetPeriod || defaultPeriod,
                  isIncluded: d.isIncluded !== undefined ? d.isIncluded : true,
                  description: d.description || null,
                  sortOrder: d.sortOrder ?? index,
                };
              }),
            });
          }
        }
      }

      return tx.package.findUnique({
        where: { id: pkg.id },
        include: {
          packageServices: {
            include: {
              service: true,
              deliverablesList: {
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
          _count: { select: { clients: true } },
        },
      });
    });
  }

  static async updatePackage(id: string, data: UpdatePackageDTO) {
    const existing = await prisma.package.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Package not found', 404);
    }

    if (data.name && data.name !== existing.name) {
      const dup = await prisma.package.findUnique({ where: { name: data.name } });
      if (dup) {
        throw new AppError('A package with this name already exists.', 409);
      }
    }

    return prisma.$transaction(async (tx) => {
      if (data.services) {
        // Cascade delete removes old packageServices and packageDeliverables
        await tx.packageService.deleteMany({ where: { packageId: id } });

        for (const s of data.services) {
          let summary = s.deliverables;
          let calculatedTarget = s.monthlyTarget;

          if (s.deliverablesList && s.deliverablesList.length > 0) {
            if (!summary) {
              summary = s.deliverablesList
                .map((d) => {
                  if (d.deliverableType === DeliverableType.FEATURE) {
                    return `${d.name}: ${d.isIncluded !== false ? 'Included' : 'Excluded'}`;
                  }
                  return `${d.name}: ${d.quantity ?? 1} ${d.unit || ''}`.trim();
                })
                .join(', ');
            }
            if (!calculatedTarget) {
              calculatedTarget = s.deliverablesList
                .filter((d) => d.deliverableType !== DeliverableType.FEATURE)
                .reduce((acc, curr) => acc + (curr.quantity || 1), 0);
              if (calculatedTarget === 0) calculatedTarget = 1;
            }
          }

          const createdPackageService = await tx.packageService.create({
            data: {
              packageId: id,
              serviceId: s.serviceId,
              monthlyTarget: calculatedTarget ?? 10,
              defaultWeight: s.defaultWeight ?? 1.0,
              deliverables: summary || null,
            },
          });

          if (s.deliverablesList && s.deliverablesList.length > 0) {
            const activeBilling = data.billingCycle || existing.billingCycle;
            const defaultPeriod =
              activeBilling === BillingCycle.ONE_TIME
                ? DeliverablePeriod.ONE_TIME
                : DeliverablePeriod.MONTHLY;

            await tx.packageDeliverable.createMany({
              data: s.deliverablesList.map((d, index) => {
                const delivType = d.deliverableType || DeliverableType.QUANTITY;
                return {
                  packageServiceId: createdPackageService.id,
                  name: d.name,
                  deliverableType: delivType,
                  quantity: delivType === DeliverableType.FEATURE ? null : (d.quantity !== undefined ? d.quantity : 1),
                  unit: delivType === DeliverableType.FEATURE ? null : (d.unit || 'unit'),
                  targetPeriod: d.targetPeriod || defaultPeriod,
                  isIncluded: d.isIncluded !== undefined ? d.isIncluded : true,
                  description: d.description || null,
                  sortOrder: d.sortOrder ?? index,
                };
              }),
            });
          }
        }
      }

      return tx.package.update({
        where: { id },
        data: {
          name: data.name,
          packageType: data.packageType,
          description: data.description,
          basePrice: data.basePrice !== undefined ? data.basePrice : undefined,
          setupFee: data.setupFee !== undefined ? data.setupFee : undefined,
          billingCycle: data.billingCycle,
          features: data.features !== undefined ? data.features : undefined,
          isActive: data.isActive !== undefined ? data.isActive : undefined,
          isArchived: data.isArchived !== undefined ? data.isArchived : undefined,
        },
        include: {
          packageServices: {
            include: {
              service: true,
              deliverablesList: {
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
          _count: { select: { clients: true } },
        },
      });
    });
  }

  static async archivePackage(id: string, isArchived: boolean = true) {
    const pkg = await prisma.package.findUnique({ where: { id } });
    if (!pkg) {
      throw new AppError('Package not found', 404);
    }
    return prisma.package.update({
      where: { id },
      data: { isArchived },
      include: {
        packageServices: {
          include: {
            service: true,
            deliverablesList: true,
          },
        },
        _count: { select: { clients: true } },
      },
    });
  }

  static async deletePackage(id: string) {
    const clientCount = await prisma.client.count({ where: { packageId: id } });
    if (clientCount > 0) {
      throw new AppError(
        `Cannot delete package. It is assigned to ${clientCount} active client(s). Please archive it instead to preserve client agreement history.`,
        400
      );
    }
    return prisma.package.delete({ where: { id } });
  }
}

export class ServiceItemService {
  static async listServices() {
    return prisma.service.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { clientServices: true, tasks: true, packageServices: true },
        },
      },
    });
  }

  static async getServiceById(id: string) {
    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        _count: {
          select: { clientServices: true, tasks: true, packageServices: true },
        },
      },
    });
    if (!service) {
      throw new AppError('Service not found', 404);
    }
    return service;
  }

  static async createService(data: {
    name: string;
    description?: string | null;
    defaultMonthlyTarget?: number;
    icon?: string | null;
    isActive?: boolean;
  }) {
    const existing = await prisma.service.findUnique({ where: { name: data.name } });
    if (existing) {
      throw new AppError('A service with this name already exists.', 409);
    }

    return prisma.service.create({
      data: {
        name: data.name,
        description: data.description,
        defaultMonthlyTarget: data.defaultMonthlyTarget ?? 10,
        icon: data.icon,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  static async updateService(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      defaultMonthlyTarget?: number;
      icon?: string | null;
      isActive?: boolean;
    }
  ) {
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Service not found', 404);
    }

    return prisma.service.update({
      where: { id },
      data,
    });
  }

  static async deleteService(id: string) {
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Service not found', 404);
    }

    const clientCount = await prisma.clientService.count({ where: { serviceId: id } });
    if (clientCount > 0) {
      throw new AppError(
        `Cannot delete service. It is currently assigned to ${clientCount} active client(s). Disable it instead.`,
        400
      );
    }

    return prisma.service.delete({ where: { id } });
  }
}
