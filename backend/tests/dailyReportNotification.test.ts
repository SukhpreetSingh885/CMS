import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db.js';
import { TaskService } from '../src/services/task.service.js';
import { DailyReportService } from '../src/services/dailyReport.service.js';
import { NotificationService } from '../src/services/notification.service.js';
import { ReportStatus, NotificationType } from '@prisma/client';

describe('VIRALSTAN CMS — DAILY WORK REPORT NOTIFICATIONS & ADMIN DEEP-LINK TESTS', () => {
  let adminUser: any;
  let testEmployee: any;
  let testClient: any;
  let testService: any;
  let testTask: any;

  const createdNotificationIds: string[] = [];
  const createdReportIds: string[] = [];

  beforeAll(async () => {
    // 1. Get or create Admin user
    adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN', status: 'ACTIVE' } });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: `admin_notif_${Date.now()}@viralstan.com`,
          password: 'hashed_password_test',
          fullName: 'Master Admin',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });
    }

    // 2. Create test employee
    testEmployee = await prisma.user.create({
      data: {
        email: `emp_notif_${Date.now()}@viralstan.com`,
        password: 'hashed_password_test',
        fullName: 'Sukh Creative Specialist',
        role: 'EMPLOYEE',
        designation: 'Content Creator',
        status: 'ACTIVE',
      },
    });

    // 3. Create test service
    testService = await prisma.service.create({
      data: {
        name: `Social Media Marketing ${Date.now()}`,
        description: 'Daily creative reels and copy generation',
        defaultMonthlyTarget: 15,
      },
    });

    // 4. Create test client
    testClient = await prisma.client.create({
      data: {
        companyName: `Aura Avenue Luxe ${Date.now()}`,
        contactPerson: 'Aura Director',
        mobileNumber: '9876543210',
        email: `contact_aura_${Date.now()}@aura.com`,
        contractStartDate: new Date(),
        contractEndDate: new Date(Date.now() + 30 * 86400000),
        renewalDate: new Date(Date.now() + 30 * 86400000),
        assignedAdminId: adminUser.id,
      },
    });

    // 5. Assign employee to client
    await prisma.clientAssignedEmployee.create({
      data: {
        clientId: testClient.id,
        userId: testEmployee.id,
      },
    });

    // 6. Create client service and task
    const clientService = await prisma.clientService.create({
      data: {
        clientId: testClient.id,
        serviceId: testService.id,
        monthlyTarget: 10,
        assignedEmployeeId: testEmployee.id,
      },
    });

    testTask = await TaskService.createTask(
      {
        clientId: testClient.id,
        serviceId: testService.id,
        assignedToId: testEmployee.id,
        title: 'Instagram Reels Production & Scheduling',
        priority: 'HIGH',
        dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      },
      adminUser.id
    );
  });

  afterAll(async () => {
    // Cleanup notifications
    if (createdNotificationIds.length > 0) {
      await prisma.notification.deleteMany({
        where: { id: { in: createdNotificationIds } },
      });
    }

    // Cleanup reports & histories
    if (createdReportIds.length > 0) {
      await prisma.dailyReportHistory.deleteMany({
        where: { reportId: { in: createdReportIds } },
      });
      await prisma.dailyWorkReport.deleteMany({
        where: { id: { in: createdReportIds } },
      });
    }

    // Cleanup task, client service, assignment, client, service, employee
    if (testTask?.id) {
      await prisma.task.deleteMany({ where: { id: testTask.id } });
    }
    await prisma.clientService.deleteMany({ where: { clientId: testClient?.id } });
    await prisma.clientAssignedEmployee.deleteMany({ where: { clientId: testClient?.id } });
    if (testClient?.id) {
      await prisma.client.deleteMany({ where: { id: testClient.id } });
    }
    if (testService?.id) {
      await prisma.service.deleteMany({ where: { id: testService.id } });
    }
    if (testEmployee?.id) {
      await prisma.user.deleteMany({ where: { id: testEmployee.id } });
    }
  });

  // 1. Successful submission creates Admin notification
  it('1. Employee submitting a Daily Work Report automatically creates an in-app notification in MySQL for Admin', async () => {
    const reportDate = new Date().toISOString().slice(0, 10);
    const report = await DailyReportService.createReport(
      {
        reportDate,
        clientId: testClient.id,
        taskId: testTask.id,
        serviceId: testService.id,
        workCompleted: 'Shot and edited 3 product showcase reels for upcoming launch',
        workDescription: 'Added captions, background audio track, color corrected in Premiere Pro',
        workPending: 'Export 4K version tomorrow morning',
        hoursSpent: 6.5,
        issuesOrBlockers: 'Waiting on client final brand logo PNG',
        nextAction: 'Schedule posts on Meta Business Suite',
        isDraft: false,
      },
      testEmployee.id
    );

    createdReportIds.push(report.id);
    expect(report.status).toBe(ReportStatus.SUBMITTED);
    expect(report.submittedAt).toBeDefined();

    // Verify notification was created for Admin
    const notification = await prisma.notification.findFirst({
      where: {
        userId: adminUser.id,
        link: `/admin/daily-reports?reportId=${report.id}`,
        type: 'REPORT',
      },
    });

    expect(notification).toBeDefined();
    if (notification) createdNotificationIds.push(notification.id);

    expect(notification?.userId).toBe(adminUser.id);
    expect(notification?.title).toBe('New Daily Work Report Submitted');
    expect(notification?.type).toBe(NotificationType.REPORT);
    expect(notification?.isRead).toBe(false);
    expect(notification?.link).toBe(`/admin/daily-reports?reportId=${report.id}`);
    expect(notification?.message).toContain('Sukh Creative Specialist');
    expect(notification?.message).toContain(testClient.companyName);
  });

  // 2. Draft creation does NOT create any notification
  it('2. Saving a Daily Work Report as DRAFT saves in MySQL but creates ZERO notifications for Admin', async () => {
    const beforeCount = await prisma.notification.count({ where: { userId: adminUser.id } });

    const draftReport = await DailyReportService.createReport(
      {
        reportDate: new Date().toISOString().slice(0, 10),
        clientId: testClient.id,
        taskId: testTask.id,
        serviceId: testService.id,
        workCompleted: 'Draft work in progress',
        workDescription: 'Draft notes',
        hoursSpent: 2.0,
        isDraft: true,
      },
      testEmployee.id
    );

    createdReportIds.push(draftReport.id);
    expect(draftReport.status).toBe(ReportStatus.DRAFT);
    expect(draftReport.submittedAt).toBeNull();

    // Verify Admin notification count did NOT increase
    const afterCount = await prisma.notification.count({ where: { userId: adminUser.id } });
    expect(afterCount).toBe(beforeCount);

    const draftNotification = await prisma.notification.findFirst({
      where: {
        link: `/admin/daily-reports?reportId=${draftReport.id}`,
      },
    });
    expect(draftNotification).toBeNull();
  });

  // 3. Submitting draft later creates the Admin notification
  it('3. Submitting a previously saved draft via submitDraft transitions status to SUBMITTED and creates the Admin notification', async () => {
    // Create draft
    const draft = await DailyReportService.createReport(
      {
        reportDate: new Date().toISOString().slice(0, 10),
        clientId: testClient.id,
        taskId: testTask.id,
        serviceId: testService.id,
        workCompleted: 'Finished editing all drafted videos',
        workDescription: 'Completed full color grading and audio leveling',
        hoursSpent: 5.0,
        isDraft: true,
      },
      testEmployee.id
    );
    createdReportIds.push(draft.id);

    // Now submit the draft
    const submitted = await DailyReportService.submitDraft(draft.id, testEmployee.id);
    expect(submitted.status).toBe(ReportStatus.SUBMITTED);
    expect(submitted.submittedAt).toBeDefined();

    // Verify Admin notification exists
    const notification = await prisma.notification.findFirst({
      where: {
        userId: adminUser.id,
        link: `/admin/daily-reports?reportId=${draft.id}`,
        type: 'REPORT',
      },
    });

    expect(notification).toBeDefined();
    if (notification) createdNotificationIds.push(notification.id);
    expect(notification?.title).toBe('New Daily Work Report Submitted');
    expect(notification?.message).toContain('Sukh Creative Specialist');
  });

  // 4. Updating draft with isDraft: false triggers submission notification
  it('4. Updating a draft via updateReport with isDraft: false transitions status to SUBMITTED and notifies Admin', async () => {
    const draft = await DailyReportService.createReport(
      {
        reportDate: new Date().toISOString().slice(0, 10),
        clientId: testClient.id,
        workCompleted: 'Initial draft copy notes',
        workDescription: 'Writing headlines and body copy',
        hoursSpent: 3.0,
        isDraft: true,
      },
      testEmployee.id
    );
    createdReportIds.push(draft.id);

    const updated = await DailyReportService.updateReport(
      draft.id,
      {
        workCompleted: 'Finalized 10 ad copy variations and approved headlines',
        isDraft: false,
      },
      testEmployee.id,
      'EMPLOYEE'
    );

    expect(updated.status).toBe(ReportStatus.SUBMITTED);

    const notification = await prisma.notification.findFirst({
      where: {
        userId: adminUser.id,
        link: `/admin/daily-reports?reportId=${draft.id}`,
        type: 'REPORT',
      },
    });

    expect(notification).toBeDefined();
    if (notification) createdNotificationIds.push(notification.id);
    expect(notification?.title).toBe('New Daily Work Report Submitted');
  });

  // 5. Prevent duplicate notifications on repeated submitDraft calls
  it('5. Repeated submitDraft requests for an already SUBMITTED report return the report without duplicating notifications', async () => {
    const report = await DailyReportService.createReport(
      {
        reportDate: new Date().toISOString().slice(0, 10),
        clientId: testClient.id,
        workCompleted: 'Single submission test work',
        workDescription: 'Testing duplicate notification prevention',
        hoursSpent: 4.0,
        isDraft: false,
      },
      testEmployee.id
    );
    createdReportIds.push(report.id);

    // Call submitDraft on already submitted report
    await DailyReportService.submitDraft(report.id, testEmployee.id);

    // Count notifications for this report link
    const notifCount = await prisma.notification.count({
      where: {
        userId: adminUser.id,
        link: `/admin/daily-reports?reportId=${report.id}`,
      },
    });

    expect(notifCount).toBe(1);
  });

  // 6. Rapid double submission duplicate protection
  it('6. Rapid double submission within 5 seconds does not create duplicate reports or notifications', async () => {
    const reportDate = new Date().toISOString().slice(0, 10);
    const dto = {
      reportDate,
      clientId: testClient.id,
      workCompleted: 'Rapid click submission test',
      workDescription: 'Rapid double click testing',
      hoursSpent: 4.5,
      isDraft: false,
    };

    const first = await DailyReportService.createReport(dto, testEmployee.id);
    createdReportIds.push(first.id);

    // Simulate immediate second click
    const second = await DailyReportService.createReport(dto, testEmployee.id);

    expect(second.id).toBe(first.id);

    const notifCount = await prisma.notification.count({
      where: {
        userId: adminUser.id,
        link: `/admin/daily-reports?reportId=${first.id}`,
      },
    });
    expect(notifCount).toBe(1);
  });

  // 7. Role and user isolation
  it('7. Role Isolation: Employees cannot access or view Admin daily report notifications', async () => {
    const employeeNotifs = await NotificationService.listUserNotifications(testEmployee.id);
    const adminNotifsInEmpList = employeeNotifs.notifications.filter((n) => n.userId === adminUser.id);
    expect(adminNotifsInEmpList.length).toBe(0);

    const adminNotifs = await NotificationService.listUserNotifications(adminUser.id);
    expect(adminNotifs.notifications.some((n) => n.userId === adminUser.id)).toBe(true);
  });

  // 8. Admin marking notification as read updates isRead and unread count
  it('8. Admin can mark notification as read, updating isRead to true and decrementing unread count', async () => {
    // Find unread notification for Admin
    const unread = await prisma.notification.findFirst({
      where: { userId: adminUser.id, isRead: false },
    });
    expect(unread).toBeDefined();

    const beforeUnread = await NotificationService.getUnreadCount(adminUser.id);

    const updated = await NotificationService.markAsRead(unread!.id, adminUser.id);
    expect(updated.isRead).toBe(true);

    const afterUnread = await NotificationService.getUnreadCount(adminUser.id);
    expect(afterUnread.unreadCount).toBe(beforeUnread.unreadCount - 1);
  });

  // 9. Admin mark all as read updates all notifications
  it('9. Admin can mark all notifications as read, setting unread count to 0', async () => {
    await NotificationService.markAllAsRead(adminUser.id);
    const unreadAfter = await NotificationService.getUnreadCount(adminUser.id);
    expect(unreadAfter.unreadCount).toBe(0);
  });

  // 10. Admin review workflow notifies submitting employee
  it('10. Admin reviewing a report (APPROVED or REVISION_REQUESTED) sends in-app notification to the submitting employee with deep-link', async () => {
    const report = await DailyReportService.createReport(
      {
        reportDate: new Date().toISOString().slice(0, 10),
        clientId: testClient.id,
        workCompleted: 'Client pitch deck design',
        workDescription: '15 slides pitch deck created',
        hoursSpent: 7.0,
        isDraft: false,
      },
      testEmployee.id
    );
    createdReportIds.push(report.id);

    // Admin approves the report
    const reviewed = await DailyReportService.reviewReport(
      report.id,
      ReportStatus.APPROVED,
      'Excellent deck design, client approved!',
      adminUser.id
    );

    expect(reviewed.status).toBe(ReportStatus.APPROVED);
    expect(reviewed.isSelfReviewed).toBe(false);

    // Verify employee received notification
    const empNotif = await prisma.notification.findFirst({
      where: {
        userId: testEmployee.id,
        link: `/employee/my-reports?reportId=${report.id}`,
        type: 'REPORT',
      },
    });

    expect(empNotif).toBeDefined();
    if (empNotif) createdNotificationIds.push(empNotif.id);
    expect(empNotif?.title).toBe('Daily Report Approved');
    expect(empNotif?.message).toContain('Excellent deck design, client approved!');
  });

  // 11. Resubmitting revised report notifies Admin as revision
  it('11. Employee resubmitting a report after REVISION_REQUESTED notifies Admin with Revised Daily Work Report title', async () => {
    const report = await DailyReportService.createReport(
      {
        reportDate: new Date().toISOString().slice(0, 10),
        clientId: testClient.id,
        workCompleted: 'Drafting reel concept',
        workDescription: 'Concept ideation',
        hoursSpent: 3.0,
        isDraft: false,
      },
      testEmployee.id
    );
    createdReportIds.push(report.id);

    // Admin requests revision
    await DailyReportService.reviewReport(
      report.id,
      ReportStatus.REVISION_REQUESTED,
      'Please add subtitles and export at 1080x1920 60fps',
      adminUser.id
    );

    // Employee updates and resubmits
    const revised = await DailyReportService.updateReport(
      report.id,
      {
        workCompleted: 'Drafting reel concept with added subtitles and 60fps export',
        workDescription: 'Added custom typography subtitles and re-exported at 60fps',
      },
      testEmployee.id,
      'EMPLOYEE'
    );

    expect(revised.status).toBe(ReportStatus.SUBMITTED);

    // Verify Admin notification with "Revised Daily Work Report Submitted"
    const revNotif = await prisma.notification.findFirst({
      where: {
        userId: adminUser.id,
        link: `/admin/daily-reports?reportId=${report.id}`,
        title: 'Revised Daily Work Report Submitted',
      },
    });

    expect(revNotif).toBeDefined();
    if (revNotif) createdNotificationIds.push(revNotif.id);
    expect(revNotif?.title).toBe('Revised Daily Work Report Submitted');
  });

  // 12. Admin self-submission does not create self-notification
  it('12. When an Admin submits a report, the notification is NOT sent to themselves', async () => {
    const beforeCount = await prisma.notification.count({ where: { userId: adminUser.id } });

    const adminReport = await DailyReportService.createReport(
      {
        reportDate: new Date().toISOString().slice(0, 10),
        clientId: testClient.id,
        workCompleted: 'Executive account strategy meeting with client CEO',
        workDescription: 'Quarterly review and contract renewal roadmap discussion',
        hoursSpent: 2.0,
        isDraft: false,
      },
      adminUser.id
    );
    createdReportIds.push(adminReport.id);

    const selfNotif = await prisma.notification.findFirst({
      where: {
        userId: adminUser.id,
        link: `/admin/daily-reports?reportId=${adminReport.id}`,
      },
    });

    expect(selfNotif).toBeNull();
  });
});
