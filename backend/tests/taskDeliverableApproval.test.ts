import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db.js';
import { TaskService } from '../src/services/task.service.js';
import { DeliverableProgressService } from '../src/services/deliverable-progress.service.js';
import { ClientService } from '../src/services/client.service.js';
import { ReportService } from '../src/services/report.service.js';
import { ApprovalService } from '../src/services/approval.service.js';
import { TaskStatus, Priority } from '@prisma/client';

describe('VIRALSTAN CMS — ADMIN APPROVAL UPDATES CLIENT PACKAGE DELIVERABLE PROGRESS', () => {
  let adminUser: any;
  let employeeUser: any;
  let anotherEmployee: any;
  let testService: any;
  let testPackage: any;
  let testClient: any;
  let testClientService: any;

  const DELIVERABLE_PAGE_ID = `deliv_pages_${Date.now()}`;
  const DELIVERABLE_FEATURE_ID = `deliv_feature_${Date.now()}`;
  const DELIVERABLE_MILESTONE_ID = `deliv_milestone_${Date.now()}`;

  beforeAll(async () => {
    // 1. Get or create Admin
    adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN', status: 'ACTIVE' } });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: `admin_deliv_${Date.now()}@viralstan.com`,
          password: 'hashed_password_test',
          fullName: 'Admin Reviewer',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });
    }

    // 2. Create Employee
    employeeUser = await prisma.user.create({
      data: {
        email: `sukh_emp_${Date.now()}@viralstan.com`,
        password: 'hashed_password_test',
        fullName: 'Sukh Web Dev',
        role: 'EMPLOYEE',
        designation: 'Senior Web Developer',
        status: 'ACTIVE',
      },
    });

    anotherEmployee = await prisma.user.create({
      data: {
        email: `other_emp_${Date.now()}@viralstan.com`,
        password: 'hashed_password_test',
        fullName: 'Other Employee',
        role: 'EMPLOYEE',
        designation: 'Graphic Designer',
        status: 'ACTIVE',
      },
    });

    // 3. Create Service
    testService = await prisma.service.create({
      data: {
        name: `Web Development_${Date.now()}`,
        description: 'Full stack website design and engineering',
        isActive: true,
      },
    });

    // 4. Create Package with multi-type deliverables
    testPackage = await prisma.package.create({
      data: {
        name: `Website Development Standard_${Date.now()}`,
        billingCycle: 'ONE_TIME',
        packageType: 'SINGLE_SERVICE',
        basePrice: 50000,
        isActive: true,
      },
    });

    // 5. Create Client
    testClient = await prisma.client.create({
      data: {
        companyName: `Aura Anenue Test_${Date.now()}`,
        contactPerson: 'Aura Director',
        email: `aura_${Date.now()}@example.com`,
        mobileNumber: '9876543210',
        billingCycle: 'ONE_TIME',
        package: { connect: { id: testPackage.id } },
        packagePricing: 50000,
        contractStartDate: new Date(),
        contractEndDate: new Date(Date.now() + 30 * 86400000),
        renewalDate: new Date(Date.now() + 30 * 86400000),
        status: 'ACTIVE',
      },
    });

    // 6. Create ClientService with agreed deliverablesConfig
    testClientService = await prisma.clientService.create({
      data: {
        clientId: testClient.id,
        serviceId: testService.id,
        assignedEmployeeId: employeeUser.id,
        monthlyTarget: 12,
        completedDeliverables: 0,
        deliverables: 'Website Pages (10 pages), Responsive Design (Feature), Milestone (1 step)',
        deliverablesConfig: [
          {
            id: DELIVERABLE_PAGE_ID,
            name: 'Website Pages',
            deliverableType: 'QUANTITY',
            quantity: 10,
            unit: 'pages',
            targetPeriod: 'ONE_TIME',
            isIncluded: true,
          },
          {
            id: DELIVERABLE_FEATURE_ID,
            name: 'Responsive Design & SEO',
            deliverableType: 'FEATURE',
            quantity: null,
            unit: null,
            targetPeriod: 'ONE_TIME',
            isIncluded: true,
          },
          {
            id: DELIVERABLE_MILESTONE_ID,
            name: 'Planning to Deployment Milestone',
            deliverableType: 'MILESTONE',
            quantity: 1,
            unit: 'milestone',
            targetPeriod: 'ONE_TIME',
            isIncluded: true,
          },
        ],
        assignedEmployees: {
          create: [{ employeeId: employeeUser.id, isActive: true }],
        },
      },
    });
  });

  afterAll(async () => {
    // Cleanup test data
    if (testClient?.id) {
      await prisma.taskComment.deleteMany({ where: { task: { clientId: testClient.id } } });
      await prisma.taskAttachment.deleteMany({ where: { task: { clientId: testClient.id } } });
      await prisma.task.deleteMany({ where: { clientId: testClient.id } });
      await prisma.clientServiceEmployeeAssignment.deleteMany({
        where: { clientService: { clientId: testClient.id } },
      });
      await prisma.clientAssignedEmployee.deleteMany({
        where: { clientId: testClient.id },
      });
      await prisma.clientService.deleteMany({ where: { clientId: testClient.id } });
      await prisma.client.deleteMany({ where: { id: testClient.id } });
    }
    if (testPackage?.id) await prisma.package.deleteMany({ where: { id: testPackage.id } });
    if (testService?.id) await prisma.service.deleteMany({ where: { id: testService.id } });
    if (employeeUser?.id) await prisma.user.deleteMany({ where: { id: employeeUser.id } });
    if (anotherEmployee?.id) await prisma.user.deleteMany({ where: { id: anotherEmployee.id } });
  });

  it('1. Initial State: Client Delivery Report shows 0 completed deliverables and 0% progress', async () => {
    const report = await ReportService.getClientDeliveryReport({ clientId: testClient.id });
    expect(report.length).toBe(1);
    expect(report[0].overallDeliveryProgress).toBe(0);
    expect(report[0].totalDeliverablesCompleted).toBe(0);
    expect(report[0].totalDeliverablesTarget).toBe(12); // 10 pages + 1 feature + 1 milestone
  });

  it('2. Guard: Cannot approve task when progress is < 100% (e.g. at 50% in progress)', async () => {
    // Create manual task linked to Website Pages
    const task = await TaskService.createTask(
      {
        title: 'web site design',
        clientId: testClient.id,
        serviceId: testService.id,
        assignedToId: employeeUser.id,
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        deliverableId: DELIVERABLE_PAGE_ID,
        deliverableName: 'Website Pages',
        deliverableCount: 10,
      },
      adminUser.id
    );

    // Employee starts task -> IN_PROGRESS at 0%
    await TaskService.startTask(task.id, employeeUser.id);

    // Employee updates progress to 50%
    await TaskService.updateTaskStatus(
      task.id,
      {
        status: TaskStatus.IN_PROGRESS,
        completionPercentage: 50,
      },
      employeeUser.id
    );

    // Attempt Admin approval while progress is 50%
    await expect(
      TaskService.approveTaskDeliverables(
        task.id,
        { approvedQuantity: 5 },
        adminUser.id
      )
    ).rejects.toThrow(/Task progress must reach 100%/i);
  });

  it('3. Guard: Cannot approve task if not submitted for review (e.g. IN_PROGRESS status)', async () => {
    const task = await prisma.task.findFirst({
      where: { clientId: testClient.id, title: 'web site design' },
    });

    // Set progress to 100% but remain in IN_PROGRESS status (not yet submitted for review)
    await prisma.task.update({
      where: { id: task!.id },
      data: { completionPercentage: 100, status: TaskStatus.IN_PROGRESS },
    });

    // Attempt Admin approval before submission for review
    await expect(
      TaskService.approveTaskDeliverables(
        task!.id,
        { approvedQuantity: 5 },
        adminUser.id
      )
    ).rejects.toThrow(/must be submitted for review/i);
  });

  it('4. Guard: Non-admin / unauthorized employee cannot approve task', async () => {
    const task = await prisma.task.findFirst({
      where: { clientId: testClient.id, title: 'web site design' },
    });

    // Submit for review
    await TaskService.updateTaskStatus(
      task!.id,
      {
        status: TaskStatus.INTERNAL_REVIEW,
        completionPercentage: 100,
      },
      employeeUser.id
    );

    // Another employee tries to approve
    await expect(
      TaskService.approveTaskDeliverables(
        task!.id,
        { approvedQuantity: 5 },
        anotherEmployee.id
      )
    ).rejects.toThrow(/Access forbidden/i);
  });

  it('5. Admin Approval with verified quantity (5 of 10 pages) updates package deliverable progress to 50%', async () => {
    const task = await prisma.task.findFirst({
      where: { clientId: testClient.id, title: 'web site design' },
    });

    // Admin approves 5 pages
    const approvedTask = await TaskService.approveTaskDeliverables(
      task!.id,
      {
        approvedQuantity: 5,
        feedback: 'Approved 5 initial pages: Home, About, Services, Pricing, and Contact.',
        deliverableId: DELIVERABLE_PAGE_ID,
      },
      adminUser.id
    );

    expect(approvedTask.status).toBe(TaskStatus.COMPLETED);
    expect(approvedTask.completionPercentage).toBe(100);
    expect(approvedTask.deliverableCount).toBe(5);

    // Verify task comment added
    const comments = await prisma.taskComment.findMany({ where: { taskId: task!.id } });
    expect(comments.some((c) => c.content.includes('Approved 5 initial pages'))).toBe(true);

    // Check Client Delivery Report
    const report = await ReportService.getClientDeliveryReport({ clientId: testClient.id });
    expect(report[0].totalDeliverablesCompleted).toBe(5);

    const svc = report[0].services[0];
    const pagesItem = svc.deliverablesBreakdown.find((d: any) => d.name === 'Website Pages');
    expect(pagesItem).toBeDefined();
    expect(pagesItem.approvedQuantity).toBe(5);
    expect(pagesItem.targetQuantity).toBe(10);
    expect(pagesItem.progressPercent).toBe(50);
    expect(pagesItem.statusText).toBe('IN_PROGRESS');

    // Overall service weighted progress: (50% + 0% + 0%) / 3 items = 17%
    expect(svc.completionPercentage).toBe(17);
    expect(report[0].overallDeliveryProgress).toBe(17);
  });

  it('6. Guard: Over-credit prevention rejects approving more than remaining target without override', async () => {
    // Create a second task for remaining pages
    const task2 = await TaskService.createTask(
      {
        title: 'additional pages implementation',
        clientId: testClient.id,
        serviceId: testService.id,
        assignedToId: employeeUser.id,
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        deliverableId: DELIVERABLE_PAGE_ID,
        deliverableName: 'Website Pages',
        deliverableCount: 8, // Employee claims 8 pages, but only 5 remain (target 10, already 5 approved)
      },
      adminUser.id
    );

    await TaskService.startTask(task2.id, employeeUser.id);
    await TaskService.updateTaskStatus(
      task2.id,
      { status: TaskStatus.INTERNAL_REVIEW, completionPercentage: 100 },
      employeeUser.id
    );

    // Admin attempts to approve 8 pages without override -> must fail because 5 + 8 = 13 > 10
    await expect(
      TaskService.approveTaskDeliverables(
        task2.id,
        { approvedQuantity: 8, allowOverCredit: false },
        adminUser.id
      )
    ).rejects.toThrow(/would exceed the agreed package target of 10/i);

    // With allowOverCredit = true, Admin can override
    const approvedTask2 = await TaskService.approveTaskDeliverables(
      task2.id,
      { approvedQuantity: 5, allowOverCredit: false }, // Adjust to remaining 5 pages
      adminUser.id
    );

    expect(approvedTask2.deliverableCount).toBe(5);

    // Now all 10 pages are completed! (5 + 5 = 10 pages)
    const report = await ReportService.getClientDeliveryReport({ clientId: testClient.id });
    const svc = report[0].services[0];
    const pagesItem = svc.deliverablesBreakdown.find((d: any) => d.name === 'Website Pages');
    expect(pagesItem.approvedQuantity).toBe(10);
    expect(pagesItem.progressPercent).toBe(100);
    expect(pagesItem.statusText).toBe('COMPLETED');
  });

  it('7. Idempotency: Re-approving with same quantity maintains exact count without double-counting', async () => {
    const task = await prisma.task.findFirst({
      where: { clientId: testClient.id, title: 'web site design' },
    });

    // Call approve again with 5
    await TaskService.approveTaskDeliverables(
      task!.id,
      { approvedQuantity: 5 },
      adminUser.id
    );

    // Total approved pages must still be exactly 10 (not 15!)
    const report = await ReportService.getClientDeliveryReport({ clientId: testClient.id });
    const svc = report[0].services[0];
    const pagesItem = svc.deliverablesBreakdown.find((d: any) => d.name === 'Website Pages');
    expect(pagesItem.approvedQuantity).toBe(10);
  });

  it('8. Universal Deliverable Support: Feature and Milestone deliverables credit accurately', async () => {
    // Create task for Feature deliverable
    const featureTask = await TaskService.createTask(
      {
        title: 'Responsive Design & Mobile Optimization',
        clientId: testClient.id,
        serviceId: testService.id,
        assignedToId: employeeUser.id,
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        deliverableId: DELIVERABLE_FEATURE_ID,
        deliverableName: 'Responsive Design & SEO',
      },
      adminUser.id
    );

    await TaskService.startTask(featureTask.id, employeeUser.id);
    await TaskService.updateTaskStatus(
      featureTask.id,
      { status: TaskStatus.INTERNAL_REVIEW, completionPercentage: 100 },
      employeeUser.id
    );

    await TaskService.approveTaskDeliverables(
      featureTask.id,
      { deliverableId: DELIVERABLE_FEATURE_ID },
      adminUser.id
    );

    // Check report: Pages = 100%, Feature = 100%, Milestone = 0% -> Overall = (100 + 100 + 0)/3 = 67%
    const report = await ReportService.getClientDeliveryReport({ clientId: testClient.id });
    const svc = report[0].services[0];
    const featureItem = svc.deliverablesBreakdown.find((d: any) => d.id === DELIVERABLE_FEATURE_ID);
    expect(featureItem.approvedQuantity).toBe(1);
    expect(featureItem.progressPercent).toBe(100);
    expect(featureItem.statusText).toBe('COMPLETED');
    expect(svc.completionPercentage).toBe(67);
  });

  it('9. Reversal & Rejection: Request Revision returns task to REVISION_REQUIRED and reverses deliverable credit', async () => {
    const featureTask = await prisma.task.findFirst({
      where: { clientId: testClient.id, title: 'Responsive Design & Mobile Optimization' },
    });

    // Admin requests revisions on the previously approved feature task
    const rejectedTask = await TaskService.rejectTask(
      featureTask!.id,
      { feedback: 'Mobile menu breaks on viewport < 375px. Please fix and resubmit.' },
      adminUser.id
    );

    expect(rejectedTask.status).toBe(TaskStatus.REVISION_REQUIRED);
    expect(rejectedTask.completionPercentage).toBe(90);

    // Feature deliverable must no longer be completed!
    const report = await ReportService.getClientDeliveryReport({ clientId: testClient.id });
    const svc = report[0].services[0];
    const featureItem = svc.deliverablesBreakdown.find((d: any) => d.id === DELIVERABLE_FEATURE_ID);
    expect(featureItem.approvedQuantity).toBe(0);
    expect(featureItem.statusText).toBe('NOT_STARTED');
    // Service overall dropped from 67% back to 33% (only pages 100% / 3)
    expect(svc.completionPercentage).toBe(33);
  });

  it('10. Employee My Assigned Clients sync reflects updated deliverable progress', async () => {
    await ClientService.syncEmployeeClientAssignments(employeeUser.id);
    const myClientsResult = await ClientService.listClients({
      assignedEmployeeId: employeeUser.id,
    });

    const clientCard = myClientsResult.clients.find((c: any) => c.id === testClient.id);
    expect(clientCard).toBeDefined();
    expect(clientCard.deliveryProgress).toBe(33);
  });
});
