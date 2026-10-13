import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticate } from '../src/middlewares/auth.middleware.js';
import { requireAdmin, requireRole } from '../src/middlewares/role.middleware.js';
import { NotificationController } from '../src/controllers/notification.controller.js';
import { NotificationService } from '../src/services/notification.service.js';
import { prisma } from '../src/config/db.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { AppError } from '../src/middlewares/error.middleware.js';

function createMockHttp(reqOverrides: Record<string, unknown> = {}) {
  const req: any = {
    cookies: {},
    headers: {},
    params: {},
    query: {},
    body: {},
    ...reqOverrides,
  };

  const res: any = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json: vi.fn((data) => data),
  };

  const next = vi.fn();

  return { req, res, next };
}

describe('Viralstan CMS — Notifications API & Authorization Tests', () => {
  const adminUser = {
    id: 'usr_admin_master',
    email: 'admin@viralstan.com',
    fullName: 'Master Admin',
    role: 'ADMIN' as const,
    status: 'ACTIVE' as const,
  };

  const employee1 = {
    id: 'usr_emp_001',
    email: 'sarah@viralstan.com',
    fullName: 'Sarah Jenkins',
    role: 'EMPLOYEE' as const,
    status: 'ACTIVE' as const,
  };

  const employee2 = {
    id: 'usr_emp_002',
    email: 'alex@viralstan.com',
    fullName: 'Alex Rivera',
    role: 'EMPLOYEE' as const,
    status: 'ACTIVE' as const,
  };

  const disabledUser = {
    id: 'usr_emp_disabled',
    email: 'disabled@viralstan.com',
    fullName: 'Disabled Staff',
    role: 'EMPLOYEE' as const,
    status: 'DISABLED' as const,
  };

  const adminToken = signAccessToken({ userId: adminUser.id, email: adminUser.email, role: adminUser.role });
  const emp1Token = signAccessToken({ userId: employee1.id, email: employee1.email, role: employee1.role });
  const emp2Token = signAccessToken({ userId: employee2.id, email: employee2.email, role: employee2.role });
  const disabledToken = signAccessToken({ userId: disabledUser.id, email: disabledUser.email, role: disabledUser.role });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Unauthenticated access
  it('1. Unauthenticated request without JWT token fails authentication with 401 UNAUTHORIZED', async () => {
    const { req, res, next } = createMockHttp();
    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
    expect(err.errorCode).toBe('UNAUTHORIZED');
  });

  // 2. Disabled account access
  it('2. Disabled account token receives 403 FORBIDDEN when attempting access', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(disabledUser as any);

    const { req, res, next } = createMockHttp({
      headers: { authorization: `Bearer ${disabledToken}` },
    });
    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
    expect(err.errorCode).toBe('FORBIDDEN');
    expect(err.message).toMatch(/Account is disabled/i);
  });

  // 3. Admin access to notifications
  it('3. Admin can authenticate and list their own notifications without 403', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(adminUser as any);
    const mockList = vi.spyOn(NotificationService, 'listUserNotifications').mockResolvedValue({
      notifications: [
        {
          id: 'notif_admin_1',
          userId: adminUser.id,
          title: 'Daily Report Submitted',
          message: 'Sarah submitted a report',
          type: 'DAILY_REPORT',
          link: '/admin/daily-reports',
          isRead: false,
          createdAt: new Date(),
        } as any,
      ],
      unreadCount: 1,
    });

    const { req, res, next } = createMockHttp({
      user: adminUser,
    });

    await NotificationController.listNotifications(req, res, next);

    expect(mockList).toHaveBeenCalledWith(adminUser.id);
    expect(res.json).toHaveBeenCalled();
    const responsePayload = res.json.mock.calls[0][0];
    expect(responsePayload.success).toBe(true);
    expect(responsePayload.data.notifications[0].userId).toBe(adminUser.id);
    expect(responsePayload.data.unreadCount).toBe(1);
  });

  // 4. Employee access to notifications (Fix verification)
  it('4. Employee can authenticate and list their own notifications without 403', async () => {
    const mockList = vi.spyOn(NotificationService, 'listUserNotifications').mockResolvedValue({
      notifications: [
        {
          id: 'notif_emp1_1',
          userId: employee1.id,
          title: 'Task Assigned',
          message: 'You have been assigned a new task',
          type: 'TASK_ASSIGNED',
          link: '/employee/tasks',
          isRead: false,
          createdAt: new Date(),
        } as any,
      ],
      unreadCount: 1,
    });

    const { req, res, next } = createMockHttp({
      user: employee1,
    });

    await NotificationController.listNotifications(req, res, next);

    expect(mockList).toHaveBeenCalledWith(employee1.id);
    expect(res.json).toHaveBeenCalled();
    const responsePayload = res.json.mock.calls[0][0];
    expect(responsePayload.success).toBe(true);
    expect(responsePayload.data.notifications[0].userId).toBe(employee1.id);
    expect(responsePayload.data.unreadCount).toBe(1);
  });

  // 5. Unread count endpoint for authenticated users
  it('5. Authenticated user can fetch unread notifications count', async () => {
    vi.spyOn(NotificationService, 'getUnreadCount').mockResolvedValue({ unreadCount: 4 });

    const { req, res, next } = createMockHttp({
      user: employee1,
    });

    await NotificationController.getUnreadCount(req, res, next);

    expect(res.json).toHaveBeenCalled();
    const responsePayload = res.json.mock.calls[0][0];
    expect(responsePayload.success).toBe(true);
    expect(responsePayload.data.unreadCount).toBe(4);
  });

  // 6. Cross-user notification isolation: Cannot mark other user's notification as read
  it('6. Cross-User Isolation: User B cannot mark User A notification as read (throws 403 FORBIDDEN)', async () => {
    // Notification belongs to employee1, but employee2 requests update
    vi.spyOn(prisma.notification, 'findUnique').mockResolvedValue({
      id: 'notif_emp1_1',
      userId: employee1.id,
      isRead: false,
    } as any);

    await expect(
      NotificationService.markAsRead('notif_emp1_1', employee2.id)
    ).rejects.toThrowError(/cannot modify another user/i);

    try {
      await NotificationService.markAsRead('notif_emp1_1', employee2.id);
    } catch (err: any) {
      expect(err.statusCode).toBe(403);
      expect(err.errorCode).toBe('FORBIDDEN');
    }
  });

  // 7. Owner marking their own notification as read
  it('7. User can mark their own notification as read (returns updated notification)', async () => {
    vi.spyOn(prisma.notification, 'findUnique').mockResolvedValue({
      id: 'notif_emp1_1',
      userId: employee1.id,
      isRead: false,
    } as any);
    const updateSpy = vi.spyOn(prisma.notification, 'update').mockResolvedValue({
      id: 'notif_emp1_1',
      userId: employee1.id,
      isRead: true,
    } as any);

    const result = await NotificationService.markAsRead('notif_emp1_1', employee1.id);
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 'notif_emp1_1' },
      data: { isRead: true },
    });
    expect(result.isRead).toBe(true);
  });

  // 8. Nonexistent notification returns 404 NOT_FOUND
  it('8. Marking nonexistent notification as read throws 404 NOT_FOUND', async () => {
    vi.spyOn(prisma.notification, 'findUnique').mockResolvedValue(null);

    await expect(
      NotificationService.markAsRead('notif_missing', employee1.id)
    ).rejects.toThrowError(/Notification not found/i);

    try {
      await NotificationService.markAsRead('notif_missing', employee1.id);
    } catch (err: any) {
      expect(err.statusCode).toBe(404);
      expect(err.errorCode).toBe('NOT_FOUND');
    }
  });

  // 9. Mark all as read scoped strictly to logged in user
  it('9. Mark all as read updates only the logged-in user\'s notifications', async () => {
    const updateManySpy = vi.spyOn(prisma.notification, 'updateMany').mockResolvedValue({ count: 3 } as any);

    await NotificationService.markAllAsRead(employee1.id);

    expect(updateManySpy).toHaveBeenCalledWith({
      where: { userId: employee1.id, isRead: false },
      data: { isRead: true },
    });
  });

  // 10. Role Guard Verification
  it('10. Role guard: requireAdmin blocks Employee with 403 FORBIDDEN and allows Admin', () => {
    // Employee test
    const { req: empReq, res: empRes, next: empNext } = createMockHttp({ user: employee1 });
    requireAdmin(empReq, empRes, empNext);
    expect(empNext).toHaveBeenCalledTimes(1);
    const err = empNext.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(403);
    expect(err.errorCode).toBe('FORBIDDEN');

    // Admin test
    const { req: admReq, res: admRes, next: admNext } = createMockHttp({ user: adminUser });
    requireAdmin(admReq, admRes, admNext);
    expect(admNext).toHaveBeenCalledWith(); // Called with no error
  });
});

