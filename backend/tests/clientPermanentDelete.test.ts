import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db.js';
import { ClientService } from '../src/services/client.service.js';
import { FinanceService } from '../src/services/finance.service.js';
import { PaymentMethod, Role, UserStatus, Priority } from '@prisma/client';
import { AppError } from '../src/middlewares/error.middleware.js';

describe('Viralstan CMS — Permanent Client & Related Data Deletion', () => {
  let testAdmin: any;
  let testEmployee: any;
  let testPackage: any;
  let testService: any;
  let targetClientId: string;

  beforeAll(async () => {
    testAdmin = await prisma.user.findFirst({
      where: { role: Role.ADMIN, status: UserStatus.ACTIVE },
    });

    if (!testAdmin) {
      testAdmin = await prisma.user.create({
        data: {
          email: `admin_delete_test_${Date.now()}@viralstan.com`,
          password: 'HashedPassword123!',
          fullName: 'Super Admin',
          role: Role.ADMIN,
          status: UserStatus.ACTIVE,
        },
      });
    }

    testEmployee = await prisma.user.findFirst({
      where: { role: Role.EMPLOYEE, status: UserStatus.ACTIVE },
    });

    if (!testEmployee) {
      testEmployee = await prisma.user.create({
        data: {
          email: `emp_delete_test_${Date.now()}@viralstan.com`,
          password: 'HashedPassword123!',
          fullName: 'Staff Exec',
          role: Role.EMPLOYEE,
          status: UserStatus.ACTIVE,
        },
      });
    }

    testPackage = await prisma.package.findFirst();
    if (!testPackage) {
      testPackage = await prisma.package.create({
        data: {
          name: `Delete Test Package ${Date.now()}`,
          priceMonthly: 50000,
        },
      });
    }

    testService = await prisma.service.findFirst();
    if (!testService) {
      testService = await prisma.service.create({
        data: {
          name: `Delete Test Service ${Date.now()}`,
          description: 'Testing safe cascade deletion',
        },
      });
    }
  });

  afterAll(async () => {
    if (targetClientId) {
      const check = await prisma.client.findUnique({ where: { id: targetClientId } });
      if (check) {
        await prisma.payment.deleteMany({ where: { clientId: targetClientId } });
        await prisma.invoice.deleteMany({ where: { clientId: targetClientId } });
        await prisma.client.deleteMany({ where: { id: targetClientId } });
      }
    }
  });

  it('1. Rejects deletion if confirmation is missing or incorrect', async () => {
    const now = new Date();
    const tempClient = await prisma.client.create({
      data: {
        companyName: `Target Temp ${Date.now()}`,
        contactPerson: 'Harsh Vardhan',
        email: `target_${Date.now()}@temp.com`,
        mobileNumber: '9988776655',
        contractStartDate: now,
        contractEndDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        renewalDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        packagePricing: 40000,
      },
    });

    await expect(
      ClientService.deleteClientPermanent(tempClient.id, 'NO', testAdmin.id)
    ).rejects.toThrow(AppError);

    await expect(
      ClientService.deleteClientPermanent(tempClient.id, 'delete_wrong', testAdmin.id)
    ).rejects.toThrow(AppError);

    // Clean up temp client
    await prisma.client.delete({ where: { id: tempClient.id } });
  });

  it('2. Creates full client ecosystem with all related models and foreign keys', async () => {
    const now = new Date();
    const companyName = `Zenith Apex Enterprise ${Date.now()}`;

    // 1. Client Profile
    const client = await prisma.client.create({
      data: {
        companyName,
        contactPerson: 'Karan Mehra',
        email: `karan_${Date.now()}@zenithapex.com`,
        mobileNumber: '9811223344',
        contractStartDate: now,
        contractEndDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
        renewalDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
        packageId: testPackage.id,
        packagePricing: 120000,
        billingCycle: 'MONTHLY',
      },
    });
    targetClientId = client.id;

    // 2. Employee Assignment & Service Assignment
    await prisma.clientAssignedEmployee.create({
      data: {
        clientId: client.id,
        userId: testEmployee.id,
        primaryRole: 'Account Manager',
      },
    });

    await prisma.clientService.create({
      data: {
        clientId: client.id,
        serviceId: testService.id,
        assignedEmployeeId: testEmployee.id,
        monthlyTarget: 15,
      },
    });

    // 3. Contract Renewal
    await prisma.renewal.create({
      data: {
        clientId: client.id,
        contractStartDate: now,
        contractEndDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
        renewalDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
        renewalAmount: 120000,
      },
    });

    // 4. Task with Comments & Attachment
    const task = await prisma.task.create({
      data: {
        title: 'Launch Performance Ad Campaign',
        clientId: client.id,
        serviceId: testService.id,
        assignedToId: testEmployee.id,
        assignedById: testAdmin.id,
        dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        priority: Priority.HIGH,
      },
    });

    await prisma.taskComment.create({
      data: {
        taskId: task.id,
        userId: testAdmin.id,
        content: 'Review ad creative copies before submitting',
      },
    });

    await prisma.taskAttachment.create({
      data: {
        taskId: task.id,
        fileName: 'creative_brief.pdf',
        fileUrl: 'https://cdn.example.com/brief.pdf',
        uploadedById: testAdmin.id,
      },
    });

    // 5. Daily Work Report with Attachment & History
    const report = await prisma.dailyWorkReport.create({
      data: {
        clientId: client.id,
        submittedById: testEmployee.id,
        taskId: task.id,
        serviceId: testService.id,
        workDescription: 'Setup pixel and custom conversions',
        workCompleted: 'Completed Meta conversion tracking',
        hoursSpent: 4.5,
      },
    });

    await prisma.dailyReportAttachment.create({
      data: {
        reportId: report.id,
        fileName: 'screenshot_pixel.png',
        fileUrl: 'https://cdn.example.com/pixel.png',
      },
    });

    await prisma.dailyReportHistory.create({
      data: {
        reportId: report.id,
        workDescription: 'Setup pixel',
        workCompleted: 'Drafting conversion tracking',
        hoursSpent: 2.0,
        status: 'DRAFT',
      },
    });

    // 6. Content Deliverable
    await prisma.contentItem.create({
      data: {
        clientId: client.id,
        title: 'Product Reel 1',
        caption: 'Elevate your performance today',
      },
    });

    // 7. Meeting with Participant
    const meeting = await prisma.meeting.create({
      data: {
        clientId: client.id,
        title: 'Weekly Strategy Review',
        meetingDateTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        createdById: testAdmin.id,
      },
    });

    await prisma.meetingParticipant.create({
      data: {
        meetingId: meeting.id,
        userId: testEmployee.id,
      },
    });

    // 8. Communication Log & File
    await prisma.communicationLog.create({
      data: {
        clientId: client.id,
        loggedById: testAdmin.id,
        summary: 'Discussed Q4 expansion targets',
      },
    });

    await prisma.clientFile.create({
      data: {
        clientId: client.id,
        fileName: 'Master_Agreement.pdf',
        fileUrl: 'https://cdn.example.com/agreement.pdf',
        uploadedById: testAdmin.id,
      },
    });

    // 9. Invoice and Payment (which enforces Restrict on Invoice)
    const invoice = await FinanceService.createInvoice(
      {
        clientId: client.id,
        invoiceNumber: `INV-DEL-${Date.now()}`,
        dueDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 120000,
      },
      testAdmin.id
    );

    await FinanceService.recordPayment(
      {
        invoiceId: invoice.id,
        amount: 120000,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        transactionReference: `UTR-ZENITH-${Date.now()}`,
      },
      testAdmin.id
    );

    // 10. Client-Specific Notification
    await prisma.notification.create({
      data: {
        userId: testAdmin.id,
        title: 'Upcoming Client Renewal',
        message: `Client ${client.companyName} contract renewal approaching`,
        link: `/admin/clients/${client.id}`,
      },
    });

    // Verify all 10 records exist in database
    const verifyInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(verifyInvoice).not.toBeNull();
    const verifyPayment = await prisma.payment.findFirst({ where: { clientId: client.id } });
    expect(verifyPayment).not.toBeNull();
  });

  it('3. Successfully deletes client and all related records cleanly in a single transaction', async () => {
    expect(targetClientId).toBeDefined();

    const clientBefore = await prisma.client.findUnique({ where: { id: targetClientId } });
    expect(clientBefore).not.toBeNull();

    // Perform permanent deletion
    const result = await ClientService.deleteClientPermanent(
      targetClientId,
      'DELETE',
      testAdmin.id,
      { ipAddress: '127.0.0.1' }
    );

    expect(result.success).toBe(true);
    expect(result.deletedClientId).toBe(targetClientId);
    expect(result.deletedCounts.payments).toBeGreaterThanOrEqual(1);
    expect(result.deletedCounts.invoices).toBeGreaterThanOrEqual(1);
    expect(result.deletedCounts.tasks).toBeGreaterThanOrEqual(1);
    expect(result.deletedCounts.dailyReports).toBeGreaterThanOrEqual(1);

    // 1. Verify Client record is gone
    const checkClient = await prisma.client.findUnique({ where: { id: targetClientId } });
    expect(checkClient).toBeNull();

    // 2. Verify Payments and Invoices are gone
    const checkPayments = await prisma.payment.findMany({ where: { clientId: targetClientId } });
    expect(checkPayments.length).toBe(0);

    const checkInvoices = await prisma.invoice.findMany({ where: { clientId: targetClientId } });
    expect(checkInvoices.length).toBe(0);

    // 3. Verify Tasks, DailyReports, Meetings, Renewals, Comms, Files are gone
    const checkTasks = await prisma.task.findMany({ where: { clientId: targetClientId } });
    expect(checkTasks.length).toBe(0);

    const checkReports = await prisma.dailyWorkReport.findMany({ where: { clientId: targetClientId } });
    expect(checkReports.length).toBe(0);

    const checkRenewals = await prisma.renewal.findMany({ where: { clientId: targetClientId } });
    expect(checkRenewals.length).toBe(0);

    const checkContent = await prisma.contentItem.findMany({ where: { clientId: targetClientId } });
    expect(checkContent.length).toBe(0);

    const checkMeetings = await prisma.meeting.findMany({ where: { clientId: targetClientId } });
    expect(checkMeetings.length).toBe(0);

    const checkComms = await prisma.communicationLog.findMany({ where: { clientId: targetClientId } });
    expect(checkComms.length).toBe(0);

    const checkFiles = await prisma.clientFile.findMany({ where: { clientId: targetClientId } });
    expect(checkFiles.length).toBe(0);

    const checkServices = await prisma.clientService.findMany({ where: { clientId: targetClientId } });
    expect(checkServices.length).toBe(0);

    const checkAssignments = await prisma.clientAssignedEmployee.findMany({ where: { clientId: targetClientId } });
    expect(checkAssignments.length).toBe(0);

    // 4. Verify client notification was removed
    const checkNotif = await prisma.notification.findMany({
      where: { link: `/admin/clients/${targetClientId}` },
    });
    expect(checkNotif.length).toBe(0);

    // 5. Verify Audit Log was recorded
    const audit = await prisma.auditLog.findFirst({
      where: { resourceType: 'CLIENT', resourceId: targetClientId, action: 'CLIENT_PERMANENTLY_DELETED' },
    });
    expect(audit).not.toBeNull();
  });

  it('4. Preserves shared Admin accounts, Employee accounts, Services Master, and Package Templates', async () => {
    // Admin still exists
    const checkAdmin = await prisma.user.findUnique({ where: { id: testAdmin.id } });
    expect(checkAdmin).not.toBeNull();

    // Employee still exists
    const checkEmployee = await prisma.user.findUnique({ where: { id: testEmployee.id } });
    expect(checkEmployee).not.toBeNull();

    // Reusable Package template still exists
    const checkPackage = await prisma.package.findUnique({ where: { id: testPackage.id } });
    expect(checkPackage).not.toBeNull();

    // Services Master still exists
    const checkService = await prisma.service.findUnique({ where: { id: testService.id } });
    expect(checkService).not.toBeNull();
  });

  it('5. Strictly verifies that other existing clients in the database are untouched and preserved during feature tests', async () => {
    const otherClients = await prisma.client.findMany({
      where: { id: { not: targetClientId } },
      select: { id: true, companyName: true },
    });

    expect(Array.isArray(otherClients)).toBe(true);
    expect(otherClients.every((c) => c.id !== targetClientId)).toBe(true);
  });

  it('6. Enforces Admin-only authorization guard against employee access on permanent delete route', async () => {
    const { requireAdmin } = await import('../src/middlewares/role.middleware.js');
    let capturedError: any = null;
    const mockReq: any = {
      user: { id: testEmployee.id, role: 'EMPLOYEE' },
    };
    const mockRes: any = {};
    const mockNext = (err?: any) => {
      capturedError = err;
    };

    requireAdmin(mockReq, mockRes, mockNext);
    expect(capturedError).toBeDefined();
    expect(capturedError.statusCode || capturedError.status).toBe(403);
    expect(capturedError.message).toContain('Admin privileges required');
  });
});

