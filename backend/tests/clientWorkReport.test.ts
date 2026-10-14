import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db.js';
import { DailyReportService } from '../src/services/dailyReport.service.js';
import { TaskService } from '../src/services/task.service.js';
import { ApprovalService } from '../src/services/approval.service.js';
import { createDailyReportSchema } from '../src/validators/dailyReport.validator.js';

describe('VIRALSTAN CMS — CLIENT WORK REPORT SYSTEM TESTS', () => {
  let adminUser: any;
  let testEmployee: any;
  let testUnassignedEmployee: any;
  let testClient: any;
  let testService: any;
  let clientServiceRecord: any;
  let testTask: any;

  const createdReportIds: string[] = [];

  beforeAll(async () => {
    // 1. Get or create Admin user
    adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN', status: 'ACTIVE' } });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: `admin_cwr_${Date.now()}@viralstan.com`,
          password: 'hashed_password_test',
          fullName: 'Master Admin',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });
    }

    // 2. Create test employees
    testEmployee = await prisma.user.create({
      data: {
        email: `emp_cwr_assigned_${Date.now()}@viralstan.com`,
        password: 'hashed_password_test',
        fullName: 'Assigned Specialist',
        role: 'EMPLOYEE',
        designation: 'Web & Graphic Designer',
        status: 'ACTIVE',
      },
    });

    testUnassignedEmployee = await prisma.user.create({
      data: {
        email: `emp_cwr_unassigned_${Date.now()}@viralstan.com`,
        password: 'hashed_password_test',
        fullName: 'Unassigned Specialist',
        role: 'EMPLOYEE',
        designation: 'Copywriter',
        status: 'ACTIVE',
      },
    });

    // 3. Create test service master
    testService = await prisma.service.create({
      data: {
        name: `Performance Marketing ${Date.now()}`,
        description: 'Multi-channel ads and performance tracking',
        defaultMonthlyTarget: 10,
      },
    });

    // 4. Create test client
    testClient = await prisma.client.create({
      data: {
        companyName: `Client Report Corp ${Date.now()}`,
        contactPerson: 'Director Corp',
        mobileNumber: '9876500112',
        email: `corp_${Date.now()}@client.com`,
        industry: 'E-commerce',
        contractStartDate: new Date(),
        contractEndDate: new Date(Date.now() + 30 * 86400000),
        renewalDate: new Date(Date.now() + 30 * 86400000),
        assignedAdminId: adminUser.id,
      },
    });

    // Assign employee directly to client as well
    await prisma.clientAssignedEmployee.create({
      data: {
        clientId: testClient.id,
        userId: testEmployee.id,
      },
    });

    // 5. Assign service to client and assign employee to service
    clientServiceRecord = await prisma.clientService.create({
      data: {
        clientId: testClient.id,
        serviceId: testService.id,
        monthlyTarget: 10,
        assignedEmployeeId: testEmployee.id,
      },
    });

    await prisma.clientServiceEmployeeAssignment.create({
      data: {
        clientServiceId: clientServiceRecord.id,
        employeeId: testEmployee.id,
      },
    });

    // 6. Create a task for this client
    testTask = await TaskService.createTask(
      {
        clientId: testClient.id,
        serviceId: testService.id,
        assignedToId: testEmployee.id,
        title: 'Design 5 Landing Page Creatives',
        description: 'Produce high CTR banner designs',
        priority: 'MEDIUM',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      },
      adminUser.id
    );
  });

  afterAll(async () => {
    // Cleanup reports created in tests
    if (createdReportIds.length > 0) {
      await prisma.dailyWorkReport.deleteMany({
        where: { id: { in: createdReportIds } },
      }).catch(() => {});
    }

    if (testTask) {
      await prisma.task.delete({ where: { id: testTask.id } }).catch(() => {});
    }

    if (clientServiceRecord) {
      await prisma.clientServiceEmployeeAssignment.deleteMany({
        where: { clientServiceId: clientServiceRecord.id },
      }).catch(() => {});
      await prisma.clientService.delete({ where: { id: clientServiceRecord.id } }).catch(() => {});
    }

    if (testClient) {
      await prisma.clientAssignedEmployee.deleteMany({ where: { clientId: testClient.id } }).catch(() => {});
      await prisma.client.delete({ where: { id: testClient.id } }).catch(() => {});
    }

    if (testService) {
      await prisma.service.delete({ where: { id: testService.id } }).catch(() => {});
    }

    if (testEmployee) {
      await prisma.user.delete({ where: { id: testEmployee.id } }).catch(() => {});
    }

    if (testUnassignedEmployee) {
      await prisma.user.delete({ where: { id: testUnassignedEmployee.id } }).catch(() => {});
    }
  });

  it('1. Schema Validator accepts full client work report inputs (quantity, unit, optional fields)', () => {
    const validPayload = {
      clientId: testClient.id,
      serviceId: testService.id,
      taskId: testTask.id,
      workCompleted: 'Completed 3 high-converting ad variations for Facebook campaign.',
      workDescription: 'Setup A/B test variations with new copy headlines and CTA buttons.',
      quantity: 3,
      unit: 'creatives',
      hoursSpent: 4.5,
      workPending: 'Review ad compliance before launching.',
      issuesOrBlockers: 'Need brand guidelines logo SVG.',
    };

    const parsed = createDailyReportSchema.parse(validPayload);
    expect(parsed.clientId).toBe(testClient.id);
    expect(parsed.quantity).toBe(3);
    expect(parsed.unit).toBe('creatives');
    expect(parsed.hoursSpent).toBe(4.5);
    expect(parsed.workCompleted).toContain('Completed 3');
  });

  it('2. Schema Validator works without optional fields (generic non-quantity service report)', () => {
    const minimalPayload = {
      clientId: testClient.id,
      workCompleted: 'Weekly client strategy meeting and alignment discussion.',
    };

    const parsed = createDailyReportSchema.parse(minimalPayload);
    expect(parsed.clientId).toBe(testClient.id);
    expect(parsed.workCompleted).toContain('Weekly client strategy');
    expect(parsed.quantity).toBeUndefined();
    expect(parsed.serviceId).toBeUndefined();
  });

  it('3. Rejects submission when employee is NOT assigned to the client', async () => {
    await expect(
      DailyReportService.createReport(
        {
          clientId: testClient.id,
          workCompleted: 'Unauthorized work attempt',
        },
        testUnassignedEmployee.id
      )
    ).rejects.toThrow(/not assigned to this client/i);
  });

  it('4. Rejects submission when specified service does not belong to the client', async () => {
    // Create an unlinked service
    const foreignService = await prisma.service.create({
      data: {
        name: `Foreign Service ${Date.now()}`,
        description: 'Unlinked to client',
      },
    });

    try {
      await expect(
        DailyReportService.createReport(
          {
            clientId: testClient.id,
            serviceId: foreignService.id,
            workCompleted: 'Work for unassigned service',
          },
          testEmployee.id
        )
      ).rejects.toThrow(/not part of this client/i);
    } finally {
      await prisma.service.delete({ where: { id: foreignService.id } }).catch(() => {});
    }
  });

  it('5. Successfully creates Client Work Report and permits multiple reports for same client on the same day', async () => {
    // Report 1: Morning report
    const report1 = await DailyReportService.createReport(
      {
        clientId: testClient.id,
        serviceId: testService.id,
        taskId: testTask.id,
        workCompleted: 'Morning session: Designed 2 initial layout mockups for review.',
        quantity: 2,
        unit: 'mockups',
        hoursSpent: 3,
      },
      testEmployee.id
    );

    expect(report1).toBeDefined();
    expect(report1.id).toBeDefined();
    expect(report1.clientId).toBe(testClient.id);
    createdReportIds.push(report1.id);

    // Report 2: Afternoon report for same client on same date (MUST NOT BE BLOCKED)
    const report2 = await DailyReportService.createReport(
      {
        clientId: testClient.id,
        serviceId: testService.id,
        taskId: testTask.id,
        workCompleted: 'Afternoon session: Revised typography and exported PNG deliverables.',
        quantity: 2,
        unit: 'mockups',
        hoursSpent: 2.5,
      },
      testEmployee.id
    );

    expect(report2).toBeDefined();
    expect(report2.id).toBeDefined();
    expect(report2.id).not.toBe(report1.id);
    createdReportIds.push(report2.id);
  });

  it('6. Client Work Reports are excluded from Admin Approval Queue', async () => {
    const approvals = await ApprovalService.getPendingApprovals();
    const foundReport = approvals.items.find((item: any) =>
      createdReportIds.includes(item.id) || item.type === 'DAILY_REPORT'
    );

    expect(foundReport).toBeUndefined();
    expect(approvals.counts.dailyReports).toBe(0);
  });

  it('7. Admin can query reports filtered by clientId', async () => {
    const listRes = await DailyReportService.listReports({
      clientId: testClient.id,
      pageSize: 10,
    });

    expect(listRes.reports.length).toBeGreaterThanOrEqual(2);
    const clientIds = listRes.reports.map((r: any) => r.clientId);
    expect(clientIds.every((cid: string) => cid === testClient.id)).toBe(true);
  });
});
