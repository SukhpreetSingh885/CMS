import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db.js';
import {
  createServiceSchema,
  updateServiceSchema,
  createPackageSchema,
} from '../src/validators/package.validator.js';
import { ServiceItemService, PackageService } from '../src/services/package.service.js';
import { TaskService } from '../src/services/task.service.js';
import { TaskStatus, Role, UserStatus, Priority } from '@prisma/client';

describe('Viralstan CMS — Universal Service & Business Package System Tests', () => {
  let createdServiceId: string;
  let secondServiceId: string;
  let createdPackageId: string;
  let testAdminUser: any;
  let testClient: any;
  let createdTaskId: string;

  beforeAll(async () => {
    testAdminUser = await prisma.user.findFirst({
      where: { role: Role.ADMIN, status: UserStatus.ACTIVE },
    });
    if (!testAdminUser) {
      testAdminUser = await prisma.user.create({
        data: {
          email: 'admin_universal_pkg@viralstan.com',
          password: 'Password123!',
          fullName: 'Universal Pkg Admin',
          role: Role.ADMIN,
          status: UserStatus.ACTIVE,
        },
      });
    }
  });

  afterAll(async () => {
    if (createdTaskId) {
      await prisma.task.delete({ where: { id: createdTaskId } }).catch(() => {});
    }
    if (testClient?.id) {
      await prisma.task.deleteMany({ where: { clientId: testClient.id } }).catch(() => {});
      await prisma.clientService.deleteMany({ where: { clientId: testClient.id } }).catch(() => {});
      await prisma.client.delete({ where: { id: testClient.id } }).catch(() => {});
    }
    if (createdPackageId) {
      await prisma.packageDeliverable.deleteMany({
        where: { packageService: { packageId: createdPackageId } },
      }).catch(() => {});
      await prisma.packageService.deleteMany({ where: { packageId: createdPackageId } }).catch(() => {});
      await prisma.package.delete({ where: { id: createdPackageId } }).catch(() => {});
    }
    if (createdServiceId) {
      await prisma.packageService.deleteMany({ where: { serviceId: createdServiceId } }).catch(() => {});
      await prisma.service.delete({ where: { id: createdServiceId } }).catch(() => {});
    }
    if (secondServiceId) {
      await prisma.packageService.deleteMany({ where: { serviceId: secondServiceId } }).catch(() => {});
      await prisma.service.delete({ where: { id: secondServiceId } }).catch(() => {});
    }
  });

  describe('1. Zod Validation & Universal Package Business Rules', () => {
    it('Validates service creation with only name and optional description', () => {
      const validPayload = {
        name: 'Technical SEO Optimization',
        description: 'Comprehensive technical SEO and organic ranking',
        isActive: true,
      };

      const parsed = createServiceSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.name).toBe('Technical SEO Optimization');
        expect(parsed.data.isActive).toBe(true);
      }
    });

    it('Validates Single Service Package with exactly 1 service', () => {
      const validSingleService = {
        name: 'Website Overhaul - Basic',
        packageType: 'SINGLE_SERVICE',
        basePrice: 45000,
        billingCycle: 'ONE_TIME',
        services: [
          {
            serviceId: 'service-web-1',
            deliverablesList: [
              { name: 'Website Pages', quantity: 5, unit: 'Pages' },
              { name: 'Revision Rounds', quantity: 2, unit: 'Rounds' },
            ],
          },
        ],
      };

      const parsed = createPackageSchema.safeParse(validSingleService);
      expect(parsed.success).toBe(true);
    });

    it('Rejects Single Service Package when multiple services are provided', () => {
      const invalidSingleService = {
        name: 'Invalid Single Package',
        packageType: 'SINGLE_SERVICE',
        basePrice: 50000,
        billingCycle: 'MONTHLY',
        services: [
          { serviceId: 'service-web-1' },
          { serviceId: 'service-seo-2' },
        ],
      };

      const parsed = createPackageSchema.safeParse(invalidSingleService);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain('exactly one selected service');
      }
    });

    it('Validates Combined Business Package with 2 or more services', () => {
      const validCombined = {
        name: 'Standard Business Growth Suite',
        packageType: 'COMBINED_BUSINESS',
        basePrice: 85000,
        billingCycle: 'MONTHLY',
        features: ['Dedicated Account Manager', 'Weekly Strategy Call', '24/7 SLA Support'],
        services: [
          {
            serviceId: 'service-web-1',
            deliverablesList: [{ name: 'Website Pages', quantity: 5, unit: 'Pages' }],
          },
          {
            serviceId: 'service-design-2',
            deliverablesList: [{ name: 'Social Media Creatives', quantity: 10, unit: 'Designs' }],
          },
        ],
      };

      const parsed = createPackageSchema.safeParse(validCombined);
      expect(parsed.success).toBe(true);
    });

    it('Rejects Combined Business Package when less than 2 services are provided', () => {
      const invalidCombined = {
        name: 'Invalid Combined Package',
        packageType: 'COMBINED_BUSINESS',
        basePrice: 85000,
        billingCycle: 'MONTHLY',
        services: [
          { serviceId: 'service-web-1' },
        ],
      };

      const parsed = createPackageSchema.safeParse(invalidCombined);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain('at least two services');
      }
    });

    it('Rejects duplicate service selections in a package', () => {
      const duplicateServices = {
        name: 'Duplicate Service Package',
        packageType: 'COMBINED_BUSINESS',
        basePrice: 70000,
        billingCycle: 'MONTHLY',
        services: [
          { serviceId: 'service-web-1' },
          { serviceId: 'service-web-1' }, // Duplicate!
        ],
      };

      const parsed = createPackageSchema.safeParse(duplicateServices);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain('Duplicate service selections');
      }
    });

    it('Rejects deliverables with negative or zero quantities', () => {
      const invalidDeliverable = {
        name: 'Zero Qty Package',
        packageType: 'SINGLE_SERVICE',
        basePrice: 30000,
        billingCycle: 'MONTHLY',
        services: [
          {
            serviceId: 'service-web-1',
            deliverablesList: [
              { name: 'Website Pages', quantity: 0, unit: 'Pages' },
            ],
          },
        ],
      };

      const parsed = createPackageSchema.safeParse(invalidDeliverable);
      expect(parsed.success).toBe(false);
    });
  });

  describe('2. MySQL Services Master & Combined Package Persistence', () => {
    it('Creates two distinct services in MySQL database', async () => {
      const svc1 = await ServiceItemService.createService({
        name: `Web Development (Test ${Date.now()})`,
        description: 'Custom React & Next.js development',
        isActive: true,
      });
      const svc2 = await ServiceItemService.createService({
        name: `Video Editing (Test ${Date.now()})`,
        description: 'Short-form Reels & Long-form YouTube edits',
        isActive: true,
      });

      expect(svc1.id).toBeDefined();
      expect(svc2.id).toBeDefined();
      createdServiceId = svc1.id;
      secondServiceId = svc2.id;
    });

    it('Creates a Combined Business Package with normalized PackageDeliverable records in MySQL', async () => {
      const pkg = await PackageService.createPackage({
        name: `Full Business Launch Suite (Test ${Date.now()})`,
        packageType: 'COMBINED_BUSINESS',
        description: 'Combined Web & Video package with multi-deliverables',
        basePrice: 95000,
        billingCycle: 'ONE_TIME',
        features: ['Full Source Code', 'Weekly Review Meetings', 'High-Speed CDN'],
        services: [
          {
            serviceId: createdServiceId,
            deliverablesList: [
              { name: 'Website Pages', quantity: 10, unit: 'Pages' },
              { name: 'Revision Rounds', quantity: 2, unit: 'Rounds' },
            ],
          },
          {
            serviceId: secondServiceId,
            deliverablesList: [
              { name: 'Instagram Reels', quantity: 12, unit: 'Reels' },
              { name: 'YouTube Videos', quantity: 4, unit: 'Videos' },
            ],
          },
        ],
      });

      expect(pkg).toBeDefined();
      expect(pkg?.id).toBeDefined();
      expect(pkg?.packageType).toBe('COMBINED_BUSINESS');
      expect(pkg?.packageServices).toHaveLength(2);

      // Verify normalized deliverables
      const webPs = pkg?.packageServices?.find((ps) => ps.serviceId === createdServiceId);
      expect(webPs?.deliverablesList).toHaveLength(2);
      expect(webPs?.deliverablesList?.some((d) => d.name === 'Website Pages' && d.quantity === 10)).toBe(true);

      const videoPs = pkg?.packageServices?.find((ps) => ps.serviceId === secondServiceId);
      expect(videoPs?.deliverablesList).toHaveLength(2);
      expect(videoPs?.deliverablesList?.some((d) => d.name === 'Instagram Reels' && d.quantity === 12)).toBe(true);

      createdPackageId = pkg!.id;
    });

    it('Archives and restores a package cleanly without deleting history', async () => {
      const archived = await PackageService.archivePackage(createdPackageId, true);
      expect(archived.isArchived).toBe(true);

      const inDbArchived = await prisma.package.findUnique({ where: { id: createdPackageId } });
      expect(inDbArchived?.isArchived).toBe(true);

      const restored = await PackageService.archivePackage(createdPackageId, false);
      expect(restored.isArchived).toBe(false);
    });
  });

  describe('3. Work Tracking: Deliverable vs Non-Deliverable Tasks', () => {
    it('Creates client agreement and verifies task completion only increments deliverables when deliverableCount > 0', async () => {
      // 1. Create client onboarded with the created service
      testClient = await prisma.client.create({
        data: {
          companyName: `Universal Deliverable Client ${Date.now()}`,
          contactPerson: 'Rahul Sharma',
          mobileNumber: '9876543210',
          email: `client_universal_${Date.now()}@example.com`,
          contractStartDate: new Date(),
          contractEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          packageId: createdPackageId,
          packagePricing: 95000,
          billingCycle: 'ONE_TIME',
          services: {
            create: [
              {
                serviceId: createdServiceId,
                monthlyTarget: 10,
                completedDeliverables: 0,
                deliverables: '10 Pages, 2 Rounds',
              },
            ],
          },
        },
        include: { services: true },
      });

      // 2. Create non-deliverable task (e.g. Client onboarding meeting, deliverableCount: 0)
      const nonDeliverableTask = await TaskService.createTask(
        {
          title: 'Kickoff Call & Asset Collection',
          clientId: testClient.id,
          serviceId: createdServiceId,
          assignedToId: testAdminUser.id,
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          deliverableCount: 0, // Non-deliverable!
        },
        testAdminUser.id
      );

      // Complete non-deliverable task
      await TaskService.updateTask(
        nonDeliverableTask.id,
        { status: TaskStatus.COMPLETED },
        testAdminUser.id
      );

      // Check client completedDeliverables - should still be 0!
      const csAfterNonDeliv = await prisma.clientService.findFirst({
        where: { clientId: testClient.id, serviceId: createdServiceId },
      });
      expect(csAfterNonDeliv?.completedDeliverables).toBe(0);

      // 3. Create deliverable task with deliverableCount: 3 (e.g. "Deliver 3 Landing Pages")
      const deliverableTask = await TaskService.createTask(
        {
          title: 'Complete and deliver 3 landing pages',
          clientId: testClient.id,
          serviceId: createdServiceId,
          assignedToId: testAdminUser.id,
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          deliverableCount: 3, // Delivers 3 units!
        },
        testAdminUser.id
      );
      createdTaskId = deliverableTask.id;

      // Complete deliverable task
      await TaskService.updateTask(
        deliverableTask.id,
        { status: TaskStatus.COMPLETED },
        testAdminUser.id
      );

      // Check client completedDeliverables - should now be exactly 3!
      const csAfterDeliv = await prisma.clientService.findFirst({
        where: { clientId: testClient.id, serviceId: createdServiceId },
      });
      expect(csAfterDeliv?.completedDeliverables).toBe(3);

      // Clean up non-deliverable task
      await prisma.task.delete({ where: { id: nonDeliverableTask.id } });
    });
  });
});
