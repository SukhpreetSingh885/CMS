import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { prisma } from '../src/config/db.js';
import { ReportService } from '../src/services/report.service.js';
import { DeliverableProgressService } from '../src/services/deliverable-progress.service.js';
import { TaskStatus, Priority } from '@prisma/client';

describe('Viralstan CMS — Service Performance Report & Agreed Deliverables System Tests', () => {
  let testAdmin: any;
  let testEmployee: any;
  let testService: any;
  let testPackage: any;
  let testClient: any;
  let testClientService: any;

  beforeAll(async () => {
    // 1. Setup Admin & Employee
    testAdmin = await prisma.user.create({
      data: {
        email: `admin_perf_test_${Date.now()}@viralstan.com`,
        password: 'hashed_password',
        fullName: 'Performance Admin',
        role: 'ADMIN',
      },
    });

    testEmployee = await prisma.user.create({
      data: {
        email: `emp_perf_test_${Date.now()}@viralstan.com`,
        password: 'hashed_password',
        fullName: 'Performance Specialist',
        role: 'EMPLOYEE',
        employeeId: `EMP_PERF_${Date.now().toString().slice(-4)}`,
      },
    });

    // 2. Setup Service
    testService = await prisma.service.create({
      data: {
        name: `Web Development Perf Test ${Date.now()}`,
        description: 'Complete web development deliverables',
        defaultMonthlyTarget: 10,
      },
    });

    // 3. Setup Package
    testPackage = await prisma.package.create({
      data: {
        name: `Web Starter Perf ${Date.now()}`,
        packageType: 'SINGLE_SERVICE',
        basePrice: 50000,
        billingCycle: 'ONE_TIME',
      },
    });

    // 4. Setup Client in ONBOARDING status (similar to Aura Anenue)
    const startDate = new Date();
    const endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const deliverablesConfig = [
      {
        id: `deliv_pages_${Date.now()}`,
        name: 'Website Pages',
        deliverableType: 'QUANTITY',
        quantity: 10,
        unit: 'pages',
        targetPeriod: 'ONE_TIME',
        isIncluded: true,
      },
      {
        id: `deliv_form_${Date.now()}`,
        name: 'Contact Form',
        deliverableType: 'QUANTITY',
        quantity: 1,
        unit: 'Units',
        targetPeriod: 'MILESTONE_BASED',
        isIncluded: true,
      },
      {
        id: `deliv_rev_${Date.now()}`,
        name: 'Revision Round',
        deliverableType: 'QUANTITY',
        quantity: 2,
        unit: 'Units',
        targetPeriod: 'ONE_TIME',
        isIncluded: true,
      },
      {
        id: `deliv_feat_${Date.now()}`,
        name: 'Responsive SEO Design',
        deliverableType: 'FEATURE',
        quantity: null,
        unit: null,
        targetPeriod: 'ONE_TIME',
        isIncluded: true,
      },
      {
        id: `deliv_mile_${Date.now()}`,
        name: 'Staging to Production Deployment',
        deliverableType: 'MILESTONE',
        quantity: 1,
        unit: 'Units',
        targetPeriod: 'MILESTONE_BASED',
        isIncluded: true,
      },
    ];

    testClient = await prisma.client.create({
      data: {
        companyName: `Aura Perf Test ${Date.now()}`,
        contactPerson: 'Aura Director',
        mobileNumber: '9876543210',
        email: `aura_perf_${Date.now()}@example.com`,
        status: 'ONBOARDING', // Onboarding status!
        isArchived: false,
        billingCycle: 'ONE_TIME',
        packageId: testPackage.id,
        contractStartDate: startDate,
        contractEndDate: endDate,
        renewalDate: endDate,
        createdById: testAdmin.id,
      },
    });

    // 5. Setup ClientService
    testClientService = await prisma.clientService.create({
      data: {
        clientId: testClient.id,
        serviceId: testService.id,
        assignedEmployeeId: testEmployee.id,
        monthlyTarget: 14,
        completedDeliverables: 0,
        status: 'ACTIVE',
        deliverables: 'Website Pages: 10 pages, Contact Form: 1 Units, Revision Round: 2 Units, Responsive SEO Design: Included, Staging Deployment: 1 Units',
        deliverablesConfig,
      },
    });

    // Link employee to client
    await prisma.clientAssignedEmployee.create({
      data: {
        clientId: testClient.id,
        userId: testEmployee.id,
      },
    });

    await prisma.clientServiceEmployeeAssignment.create({
      data: {
        clientServiceId: testClientService.id,
        employeeId: testEmployee.id,
      },
    });
  });

  afterAll(async () => {
    // Cleanup created records
    try {
      if (testClient?.id) {
        await prisma.taskComment.deleteMany({ where: { task: { clientId: testClient.id } } });
        await prisma.taskAttachment.deleteMany({ where: { task: { clientId: testClient.id } } });
        await prisma.task.deleteMany({ where: { clientId: testClient.id } });
        await prisma.clientServiceEmployeeAssignment.deleteMany({ where: { clientService: { clientId: testClient.id } } });
        await prisma.clientAssignedEmployee.deleteMany({ where: { clientId: testClient.id } });
        await prisma.clientService.deleteMany({ where: { clientId: testClient.id } });
        await prisma.client.delete({ where: { id: testClient.id } });
      }
      if (testPackage?.id) await prisma.package.delete({ where: { id: testPackage.id } });
      if (testService?.id) await prisma.service.delete({ where: { id: testService.id } });
      if (testEmployee?.id) await prisma.user.delete({ where: { id: testEmployee.id } });
      if (testAdmin?.id) await prisma.user.delete({ where: { id: testAdmin.id } });
    } catch {
      // Ignored
    }
  });

  afterEach(async () => {
    try {
      if (testClient?.id) {
        await prisma.taskComment.deleteMany({ where: { task: { clientId: testClient.id } } });
        await prisma.taskAttachment.deleteMany({ where: { task: { clientId: testClient.id } } });
        await prisma.task.deleteMany({ where: { clientId: testClient.id } });
      }
    } catch {
      // Ignored
    }
  });

  it('1. Web Development correctly identifies Onboarding client as Active Client (Fixes Active Clients: 0)', async () => {
    const report = await ReportService.getServicePerformanceReport();
    const svcReport = report.find((s) => s.serviceId === testService.id);

    expect(svcReport).toBeDefined();
    // Non-archived client with active service must count as activeClient
    expect(svcReport?.activeClients).toBe(1);
    expect(svcReport?.strictlyActiveClients).toBe(0);
    expect(svcReport?.onboardingClients).toBe(1);
  });

  it('2. General setup task completed 100% does NOT automatically count as completed agreed deliverable', async () => {
    // Create general setup task with deliverableCount = 0 (identical to "Initial Deliverables: Web Development setup")
    const setupTask = await prisma.task.create({
      data: {
        title: 'Initial Deliverables: Web Development setup',
        clientId: testClient.id,
        serviceId: testService.id,
        assignedToId: testEmployee.id,
        assignedById: testAdmin.id,
        reviewerId: testAdmin.id,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        status: TaskStatus.COMPLETED,
        completionPercentage: 100,
        deliverableCount: 0,
        clientApprovalRequired: false,
      },
    });

    const report = await ReportService.getServicePerformanceReport();
    const svcReport = report.find((s) => s.serviceId === testService.id);

    expect(svcReport).toBeDefined();
    // Task progress is tracked:
    expect(svcReport?.tasksCreated).toBe(1);
    expect(svcReport?.tasksCompleted).toBe(1);
    expect(svcReport?.taskCompletionRate).toBe(100);

    // BUT Deliverable progress must strictly remain 0%:
    expect(svcReport?.approvedDeliverableProgress).toBe(0);
    expect(svcReport?.completedDeliverables).toBe(0);

    // Each individual deliverable item remains 0%:
    const pagesItem = svcReport?.deliverablesBreakdown.find((d) => d.name === 'Website Pages');
    expect(pagesItem?.approvedQuantity).toBe(0);
    expect(pagesItem?.progressPercent).toBe(0);
    expect(pagesItem?.statusText).toBe('NOT_STARTED');

    // Clean up setup task
    await prisma.task.delete({ where: { id: setupTask.id } });
  });

  it('3. QUANTITY Deliverable: Approved units accurately increment deliverable progress', async () => {
    const delivConfig = testClientService.deliverablesConfig as any[];
    const pagesDeliv = delivConfig.find((d) => d.name === 'Website Pages');

    // Create task linked to Website Pages with deliverableCount = 3
    const pagesTask = await prisma.task.create({
      data: {
        title: 'Develop Homepage, About, and Contact Pages',
        clientId: testClient.id,
        serviceId: testService.id,
        assignedToId: testEmployee.id,
        assignedById: testAdmin.id,
        reviewerId: testAdmin.id,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        status: TaskStatus.APPROVED,
        completionPercentage: 100,
        deliverableCount: 3,
        clientApprovalRequired: true,
        internalNotes: DeliverableProgressService.formatInternalNotesWithMeta(null, {
          deliverableId: pagesDeliv.id,
          deliverableName: pagesDeliv.name,
        }),
      },
    });

    const report = await ReportService.getServicePerformanceReport();
    const svcReport = report.find((s) => s.serviceId === testService.id);

    expect(svcReport).toBeDefined();
    const pagesItem = svcReport?.deliverablesBreakdown.find((d) => d.name === 'Website Pages');
    expect(pagesItem?.approvedQuantity).toBe(3);
    expect(pagesItem?.targetQuantity).toBe(10);
    expect(pagesItem?.progressPercent).toBe(30); // 3 / 10 = 30%
    expect(pagesItem?.statusText).toBe('IN_PROGRESS');

    // Equal-weighted overall average across 5 items: (30 + 0 + 0 + 0 + 0) / 5 = 6%
    expect(svcReport?.approvedDeliverableProgress).toBe(6);

    await prisma.task.delete({ where: { id: pagesTask.id } });
  });

  it('4. Approval Rule: Task progress does NOT count toward deliverables before legitimate approval', async () => {
    const delivConfig = testClientService.deliverablesConfig as any[];
    const pagesDeliv = delivConfig.find((d) => d.name === 'Website Pages');

    // Task is in CLIENT_APPROVAL or IN_PROGRESS (not approved yet)
    const pendingApprovalTask = await prisma.task.create({
      data: {
        title: 'Build 4 more pages (Awaiting Client Approval)',
        clientId: testClient.id,
        serviceId: testService.id,
        assignedToId: testEmployee.id,
        assignedById: testAdmin.id,
        reviewerId: testAdmin.id,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        status: TaskStatus.CLIENT_APPROVAL,
        completionPercentage: 100,
        deliverableCount: 4,
        clientApprovalRequired: true,
        internalNotes: DeliverableProgressService.formatInternalNotesWithMeta(null, {
          deliverableId: pagesDeliv.id,
          deliverableName: pagesDeliv.name,
        }),
      },
    });

    const report = await ReportService.getServicePerformanceReport();
    const svcReport = report.find((s) => s.serviceId === testService.id);

    const pagesItem = svcReport?.deliverablesBreakdown.find((d) => d.name === 'Website Pages');
    // Because it is in CLIENT_APPROVAL and not APPROVED, approvedQuantity must remain 0:
    expect(pagesItem?.approvedQuantity).toBe(0);
    expect(pagesItem?.progressPercent).toBe(0);

    // Now Admin approves the task:
    await prisma.task.update({
      where: { id: pendingApprovalTask.id },
      data: { status: TaskStatus.APPROVED },
    });

    const updatedReport = await ReportService.getServicePerformanceReport();
    const updatedSvcReport = updatedReport.find((s) => s.serviceId === testService.id);
    const updatedPagesItem = updatedSvcReport?.deliverablesBreakdown.find((d) => d.name === 'Website Pages');

    expect(updatedPagesItem?.approvedQuantity).toBe(4);
    expect(updatedPagesItem?.progressPercent).toBe(40);

    await prisma.task.delete({ where: { id: pendingApprovalTask.id } });
  });

  it('5. FEATURE Deliverable: Completion states work accurately (NOT_STARTED, IN_PROGRESS, COMPLETED)', async () => {
    const delivConfig = testClientService.deliverablesConfig as any[];
    const featDeliv = delivConfig.find((d) => d.name === 'Responsive SEO Design');

    // Initial state: 0%
    let report = await ReportService.getServicePerformanceReport();
    let svc = report.find((s) => s.serviceId === testService.id);
    let featItem = svc?.deliverablesBreakdown.find((d) => d.name === 'Responsive SEO Design');
    expect(featItem?.progressPercent).toBe(0);
    expect(featItem?.statusText).toBe('NOT_STARTED');

    // In Progress state:
    const featTask = await prisma.task.create({
      data: {
        title: 'Implement SEO meta tags and responsive breakpoints',
        clientId: testClient.id,
        serviceId: testService.id,
        assignedToId: testEmployee.id,
        assignedById: testAdmin.id,
        reviewerId: testAdmin.id,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        status: TaskStatus.IN_PROGRESS,
        completionPercentage: 50,
        deliverableCount: 1,
        internalNotes: DeliverableProgressService.formatInternalNotesWithMeta(null, {
          deliverableId: featDeliv.id,
          deliverableName: featDeliv.name,
        }),
      },
    });

    report = await ReportService.getServicePerformanceReport();
    svc = report.find((s) => s.serviceId === testService.id);
    featItem = svc?.deliverablesBreakdown.find((d) => d.name === 'Responsive SEO Design');
    expect(featItem?.progressPercent).toBe(50);
    expect(featItem?.statusText).toBe('IN_PROGRESS');

    // Completed / Approved state:
    await prisma.task.update({
      where: { id: featTask.id },
      data: { status: TaskStatus.APPROVED, completionPercentage: 100 },
    });

    report = await ReportService.getServicePerformanceReport();
    svc = report.find((s) => s.serviceId === testService.id);
    featItem = svc?.deliverablesBreakdown.find((d) => d.name === 'Responsive SEO Design');
    expect(featItem?.progressPercent).toBe(100);
    expect(featItem?.statusText).toBe('COMPLETED');

    await prisma.task.delete({ where: { id: featTask.id } });
  });

  it('6. Lifecycle Deliverables (ONE_TIME, CAMPAIGN_SCOPE, MILESTONE_BASED) preserve cumulative approved progress without resetting monthly', async () => {
    const delivConfig = testClientService.deliverablesConfig as any[];
    const pagesDeliv = delivConfig.find((d) => d.name === 'Website Pages');

    // Create a task approved 45 days ago
    const pastDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const cumulativeTask = await prisma.task.create({
      data: {
        title: 'Legacy Phase 1 Pages',
        clientId: testClient.id,
        serviceId: testService.id,
        assignedToId: testEmployee.id,
        assignedById: testAdmin.id,
        reviewerId: testAdmin.id,
        dueDate: pastDate,
        createdAt: pastDate,
        updatedAt: pastDate,
        status: TaskStatus.APPROVED,
        completionPercentage: 100,
        deliverableCount: 5,
        internalNotes: DeliverableProgressService.formatInternalNotesWithMeta(null, {
          deliverableId: pagesDeliv.id,
          deliverableName: pagesDeliv.name,
        }),
      },
    });

    // Requesting report for "this_month"
    const report = await ReportService.getServicePerformanceReport({ dateRange: 'this_month' });
    const svc = report.find((s) => s.serviceId === testService.id);
    const pagesItem = svc?.deliverablesBreakdown.find((d) => d.name === 'Website Pages');

    // Because Website Pages is ONE_TIME (Project Lifecycle Scope), it cumulative tracks across contract without monthly reset:
    expect(pagesItem?.approvedQuantity).toBe(5);
    expect(pagesItem?.progressPercent).toBe(50); // 5/10 = 50%

    await prisma.task.delete({ where: { id: cumulativeTask.id } });
  });

  it('7. Aggregation Formula: Does NOT sum unrelated deliverable quantities (10 pages + 1 form + 2 revisions = 13)', async () => {
    const delivConfig = testClientService.deliverablesConfig as any[];
    const formDeliv = delivConfig.find((d) => d.name === 'Contact Form'); // 1 unit

    // If Contact Form (1 unit) is approved:
    // If the system naively summed quantities, progress would be 1/14 = 7%.
    // With equal-weighted item progress:
    // Contact Form is 1/1 = 100%. Other 4 items are 0%.
    // Overall progress = (0 + 100 + 0 + 0 + 0) / 5 = 20%!
    const formTask = await prisma.task.create({
      data: {
        title: 'Integrate Contact and Lead Capture Forms',
        clientId: testClient.id,
        serviceId: testService.id,
        assignedToId: testEmployee.id,
        assignedById: testAdmin.id,
        reviewerId: testAdmin.id,
        dueDate: new Date(),
        status: TaskStatus.APPROVED,
        completionPercentage: 100,
        deliverableCount: 1,
        internalNotes: DeliverableProgressService.formatInternalNotesWithMeta(null, {
          deliverableId: formDeliv.id,
          deliverableName: formDeliv.name,
        }),
      },
    });

    const report = await ReportService.getServicePerformanceReport();
    const svc = report.find((s) => s.serviceId === testService.id);
    const formItem = svc?.deliverablesBreakdown.find((d) => d.name === 'Contact Form');

    expect(formItem?.approvedQuantity).toBe(1);
    expect(formItem?.progressPercent).toBe(100);
    expect(svc?.approvedDeliverableProgress).toBe(20); // (100% / 5 items) = 20%

    await prisma.task.delete({ where: { id: formTask.id } });
  });
});
