import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientService } from '../src/services/client.service.js';
import { TaskService } from '../src/services/task.service.js';
import { DailyReportService } from '../src/services/dailyReport.service.js';
import { prisma } from '../src/config/db.js';
import { AppError } from '../src/utils/AppError.js';
import { TaskStatus, ClientStatus } from '@prisma/client';

describe('Viralstan CMS — Employee Assigned Client Access & Authorization Tests', () => {
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

  const assignedClient = {
    id: 'client_nike_001',
    companyName: 'Nike India',
    industry: 'Sportswear & Apparel',
    status: ClientStatus.ACTIVE,
    isArchived: false,
    assignedEmployees: [{ id: 'cae_1', clientId: 'client_nike_001', userId: employee1.id }],
    services: [],
    invoices: [],
  };

  const unassignedClient = {
    id: 'client_apple_002',
    companyName: 'Apple India',
    industry: 'Consumer Electronics',
    status: ClientStatus.ACTIVE,
    isArchived: false,
    assignedEmployees: [{ id: 'cae_2', clientId: 'client_apple_002', userId: employee2.id }],
    services: [],
    invoices: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Employee sees all Clients explicitly assigned to them
  it('1. Employee queries only their assigned clients via getMyClients / assignedEmployeeId', async () => {
    const findManySpy = vi.spyOn(prisma.client, 'findMany').mockResolvedValue([assignedClient as any]);
    vi.spyOn(prisma.client, 'count').mockResolvedValue(1);

    const result = await ClientService.listClients({
      assignedEmployeeId: employee1.id,
    });

    expect(result.clients).toHaveLength(1);
    expect(result.clients[0].id).toBe('client_nike_001');
    expect(findManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignedEmployees: { some: { userId: employee1.id } },
        }),
      })
    );
  });

  // 2. Employee cannot see unassigned Clients in assigned list
  it('2. Unassigned client is not returned to employee with zero assignments', async () => {
    vi.spyOn(prisma.client, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.client, 'count').mockResolvedValue(0);

    const result = await ClientService.listClients({
      assignedEmployeeId: 'usr_emp_unassigned',
    });

    expect(result.clients).toHaveLength(0);
  });

  // 3. Employee sees only their own Tasks for assigned Clients
  it('3. Employee listTasks strictly queries tasks where assignedToId is the logged-in user', async () => {
    const findManySpy = vi.spyOn(prisma.task, 'findMany').mockResolvedValue([
      {
        id: 'task_001',
        title: 'Design Instagram Carousels',
        clientId: 'client_nike_001',
        assignedToId: employee1.id,
        status: TaskStatus.IN_PROGRESS,
        dueDate: new Date(Date.now() + 86400000),
      } as any,
    ]);
    vi.spyOn(prisma.task, 'count').mockResolvedValue(1);

    const result = await TaskService.listTasks({
      assignedToId: employee1.id,
      clientId: 'client_nike_001',
    });

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].assignedToId).toBe(employee1.id);
    expect(findManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignedToId: employee1.id,
          clientId: 'client_nike_001',
        }),
      })
    );
  });

  // 4. Employee cannot access another Client through direct API URL
  it('4. Employee requesting unassigned client by ID receives 403 FORBIDDEN', async () => {
    // Client has only employee2 assigned
    vi.spyOn(prisma.client, 'findUnique').mockResolvedValue(unassignedClient as any);

    await expect(
      ClientService.getClientById('client_apple_002', employee1)
    ).rejects.toThrowError(/not assigned to this client/i);

    try {
      await ClientService.getClientById('client_apple_002', employee1);
    } catch (err: any) {
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(403);
      expect(err.errorCode).toBe('FORBIDDEN');
    }
  });

  // 5. Employee CAN access assigned Client by ID
  it('5. Employee requesting their assigned client by ID receives 200 OK client details', async () => {
    vi.spyOn(prisma.client, 'findUnique').mockResolvedValue(assignedClient as any);

    const client = await ClientService.getClientById('client_nike_001', employee1);
    expect(client).toBeDefined();
    expect(client.id).toBe('client_nike_001');
  });

  // 6. Admin can access any Client without restriction
  it('6. Admin can view any client by ID without assignment restriction', async () => {
    vi.spyOn(prisma.client, 'findUnique').mockResolvedValue(unassignedClient as any);

    const client = await ClientService.getClientById('client_apple_002', adminUser);
    expect(client).toBeDefined();
    expect(client.id).toBe('client_apple_002');
  });

  // 7. Employee cannot access tasks of unassigned client
  it('7. Employee cannot access task of unassigned client directly (throws 403 FORBIDDEN)', async () => {
    vi.spyOn(prisma.task, 'findUnique').mockResolvedValue({
      id: 'task_apple_001',
      clientId: 'client_apple_002',
      assignedToId: employee2.id, // Assigned to Alex
      dueDate: new Date(),
      status: TaskStatus.IN_PROGRESS,
    } as any);

    // Sarah (employee1) is not assigned to Apple
    vi.spyOn(prisma.clientAssignedEmployee, 'findUnique').mockResolvedValue(null);

    await expect(
      TaskService.getTaskById('task_apple_001', employee1)
    ).rejects.toThrowError(/cannot access tasks for this client/i);

    try {
      await TaskService.getTaskById('task_apple_001', employee1);
    } catch (err: any) {
      expect(err.statusCode).toBe(403);
      expect(err.errorCode).toBe('FORBIDDEN');
    }
  });

  // 8. Employee cannot submit daily report for unassigned client
  it('8. Employee cannot submit a daily report for an unassigned client (throws 403 FORBIDDEN)', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(employee1 as any);
    vi.spyOn(prisma.clientAssignedEmployee, 'findUnique').mockResolvedValue(null);

    await expect(
      DailyReportService.createReport(
        {
          clientId: 'client_apple_002',
          workDescription: 'Created social media copy',
          workCompleted: 'Drafted 3 posts',
          hoursSpent: 2,
        },
        employee1.id
      )
    ).rejects.toThrowError(/not assigned to this client/i);
  });

  // 9. Admin removing employee assignment triggers alert notification for unfinished tasks
  it('9. Removing employee from client notifies Admin of pending unfinished tasks', async () => {
    vi.spyOn(prisma.client, 'findUnique').mockResolvedValue(assignedClient as any);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(adminUser as any);
    vi.spyOn(prisma.user, 'findFirst').mockResolvedValue(adminUser as any);
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as any);

    const notificationSpy = vi.spyOn(prisma.notification, 'create').mockResolvedValue({} as any);

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      const mockTx = {
        clientAssignedEmployee: {
          findMany: vi.fn().mockResolvedValue([{ userId: employee1.id, clientId: 'client_nike_001' }]),
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
          createMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        task: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'task_pending_1',
              title: 'Unfinished Brand Banner',
              assignedToId: employee1.id,
              status: TaskStatus.IN_PROGRESS,
            },
          ]),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue(employee1),
          findFirst: vi.fn().mockResolvedValue(adminUser),
        },
        notification: {
          create: notificationSpy,
        },
        client: {
          update: vi.fn().mockResolvedValue({ ...assignedClient, assignedEmployees: [] }),
        },
      };
      return callback(mockTx);
    });

    await ClientService.updateClient(
      'client_nike_001',
      { assignedEmployeeIds: [] }, // Removing employee1
      adminUser.id
    );

    expect(notificationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: adminUser.id,
          title: 'Pending Tasks Require Reassignment',
          type: 'TASK',
        }),
      })
    );
  });

  // 10. Employee cannot update another employee's task progress
  it('10. Employee attempting to update another employee task progress receives 403 FORBIDDEN', async () => {
    vi.spyOn(prisma.task, 'findUnique').mockResolvedValue({
      id: 'task_other_emp',
      clientId: 'client_apple_002',
      assignedToId: employee2.id,
      reviewerId: adminUser.id,
      status: TaskStatus.IN_PROGRESS,
      completionPercentage: 25,
      dueDate: new Date(Date.now() + 86400000),
    } as any);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(employee1 as any);

    await expect(
      TaskService.updateTaskStatus(
        'task_other_emp',
        { status: TaskStatus.IN_PROGRESS, completionPercentage: 50 },
        employee1.id
      )
    ).rejects.toThrowError(/only update tasks assigned to you/i);
  });

  // 11. Employee can update milestone progress to 100% while keeping status IN_PROGRESS until submitted for review
  it('11. Employee updates own task progress to 100% without auto-approving and receives enriched task details', async () => {
    const dueTomorrow = new Date(Date.now() + 86400000);
    vi.spyOn(prisma.task, 'findUnique').mockResolvedValue({
      id: 'task_own_001',
      clientId: 'client_nike_001',
      assignedToId: employee1.id,
      reviewerId: adminUser.id,
      status: TaskStatus.IN_PROGRESS,
      completionPercentage: 75,
      deliverableCount: 1,
      dueDate: dueTomorrow,
    } as any);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(employee1 as any);
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as any);

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      const mockTx = {
        task: {
          update: vi.fn().mockResolvedValue({
            id: 'task_own_001',
            title: 'Build Landing Page',
            clientId: 'client_nike_001',
            assignedToId: employee1.id,
            status: TaskStatus.IN_PROGRESS,
            completionPercentage: 100,
            dueDate: dueTomorrow,
            client: { id: 'client_nike_001', companyName: 'Nike India' },
            service: { id: 'svc_web', name: 'Website Development' },
          }),
        },
        taskComment: {
          create: vi.fn(),
        },
        clientService: {
          updateMany: vi.fn(),
        },
      };
      return callback(mockTx);
    });

    const updated = await TaskService.updateTaskStatus(
      'task_own_001',
      { status: TaskStatus.IN_PROGRESS, completionPercentage: 100 },
      employee1.id
    );

    expect(updated.status).toBe(TaskStatus.IN_PROGRESS);
    expect(updated.completionPercentage).toBe(100);
    expect(updated.isOverdue).toBe(false);
    expect((updated as any).service?.name).toBe('Website Development');
  });

  // 12. Newly created task defaults to Not Started (ASSIGNED) with 0% progress and null startedAt
  it('12. Newly created task starts with ASSIGNED status, 0% progress, and null startedAt', async () => {
    const dueTomorrow = new Date(Date.now() + 86400000);
    vi.spyOn(prisma.client, 'findUnique').mockResolvedValue(assignedClient as any);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(employee1 as any);
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as any);
    vi.spyOn(prisma.notification, 'create').mockResolvedValue({} as any);

    vi.spyOn(prisma.task, 'create').mockImplementation((({ data }: any) =>
      Promise.resolve({
        id: 'task_new_001',
        ...data,
        startedAt: null,
        startedById: null,
        client: { id: 'client_nike_001', companyName: 'Nike India' },
        assignedTo: employee1,
        startedBy: null,
        service: null,
        comments: [],
      }) as any) as any);

    const created = await TaskService.createTask(
      {
        title: 'Write SEO Meta Descriptions',
        clientId: 'client_nike_001',
        assignedToId: employee1.id,
        dueDate: dueTomorrow.toISOString(),
      },
      adminUser.id
    );

    expect(created.status).toBe(TaskStatus.ASSIGNED);
    expect(created.completionPercentage).toBe(0);
    expect((created as any).startedAt).toBeNull();
    expect((created as any).startedById).toBeNull();
  });

  // 13. Assigned employee starts task -> IN_PROGRESS, 0% progress, startedAt and startedById recorded
  it('13. Assigned employee starting a task sets IN_PROGRESS, preserves 0% progress, and records startedAt & startedById', async () => {
    const dueTomorrow = new Date(Date.now() + 86400000);
    vi.spyOn(prisma.task, 'findUnique').mockResolvedValue({
      id: 'task_start_001',
      title: 'Setup Analytics Pixel',
      clientId: 'client_nike_001',
      assignedToId: employee1.id,
      status: TaskStatus.ASSIGNED,
      completionPercentage: 0,
      startedAt: null,
      startedById: null,
      dueDate: dueTomorrow,
    } as any);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(employee1 as any);
    const auditSpy = vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as any);

    const updateManySpy = vi.fn().mockResolvedValue({ count: 1 });
    const commentCreateSpy = vi.fn().mockResolvedValue({});

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      const recordedNow = new Date('2026-10-13T10:00:00.000Z');
      return callback({
        task: {
          updateMany: updateManySpy,
          findUnique: vi.fn().mockResolvedValue({
            id: 'task_start_001',
            title: 'Setup Analytics Pixel',
            clientId: 'client_nike_001',
            assignedToId: employee1.id,
            status: TaskStatus.IN_PROGRESS,
            completionPercentage: 0,
            startedAt: recordedNow,
            startedById: employee1.id,
            startedBy: { id: employee1.id, fullName: employee1.fullName, email: employee1.email },
            dueDate: dueTomorrow,
            comments: [],
          }),
        },
        taskComment: {
          create: commentCreateSpy,
        },
      });
    });

    const started = await TaskService.startTask('task_start_001', employee1.id);

    expect(started.status).toBe(TaskStatus.IN_PROGRESS);
    expect(started.completionPercentage).toBe(0);
    expect((started as any).startedAt).toBeInstanceOf(Date);
    expect((started as any).startedById).toBe(employee1.id);
    expect(updateManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'task_start_001',
          assignedToId: employee1.id,
          status: { in: [TaskStatus.CREATED, TaskStatus.ASSIGNED] },
          startedAt: null,
        },
        data: expect.objectContaining({
          status: TaskStatus.IN_PROGRESS,
          startedById: employee1.id,
          completionPercentage: 0,
        }),
      })
    );
    expect(commentCreateSpy).toHaveBeenCalledTimes(1);
    expect(auditSpy).toHaveBeenCalledTimes(1);
  });

  // 14. Employee cannot start another employee's task
  it('14. Employee cannot start a task assigned to another employee (throws 403 FORBIDDEN)', async () => {
    vi.spyOn(prisma.task, 'findUnique').mockResolvedValue({
      id: 'task_other_start',
      title: 'Competitor Audit',
      clientId: 'client_apple_002',
      assignedToId: employee2.id,
      status: TaskStatus.ASSIGNED,
      completionPercentage: 0,
      startedAt: null,
      dueDate: new Date(Date.now() + 86400000),
    } as any);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(employee1 as any);

    await expect(
      TaskService.startTask('task_other_start', employee1.id)
    ).rejects.toThrowError(/Only the employee assigned to this task can start it/i);
  });

  // 15. Clicking Start Task repeatedly does not create duplicate start events or overwrite startedAt
  it('15. Repeated Start Task calls on an already started task preserve original startedAt and skip duplicate comments/audits', async () => {
    const originalStartedAt = new Date('2026-10-12T09:30:00.000Z');
    const dueTomorrow = new Date(Date.now() + 86400000);

    vi.spyOn(prisma.task, 'findUnique').mockResolvedValue({
      id: 'task_already_started',
      title: 'Initial Deliverables: Web Development setup',
      clientId: 'client_nike_001',
      assignedToId: employee1.id,
      status: TaskStatus.IN_PROGRESS,
      completionPercentage: 25,
      startedAt: originalStartedAt,
      startedById: employee1.id,
      dueDate: dueTomorrow,
    } as any);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(employee1 as any);
    const txSpy = vi.spyOn(prisma, '$transaction');
    const auditSpy = vi.spyOn(prisma.auditLog, 'create');

    const result = await TaskService.startTask('task_already_started', employee1.id);

    expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    expect(result.completionPercentage).toBe(25);
    expect((result as any).startedAt).toEqual(originalStartedAt);
    expect(txSpy).not.toHaveBeenCalled();
    expect(auditSpy).not.toHaveBeenCalled();
  });

  // 16. Employee cannot update progress before starting the task
  it('16. Employee cannot update task progress while task is still ASSIGNED (Not Started)', async () => {
    vi.spyOn(prisma.task, 'findUnique').mockResolvedValue({
      id: 'task_unstarted_001',
      title: 'Create Brand Guidelines PDF',
      clientId: 'client_nike_001',
      assignedToId: employee1.id,
      status: TaskStatus.ASSIGNED,
      completionPercentage: 0,
      startedAt: null,
      dueDate: new Date(Date.now() + 86400000),
    } as any);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(employee1 as any);

    await expect(
      TaskService.updateTaskStatus(
        'task_unstarted_001',
        { status: TaskStatus.IN_PROGRESS, completionPercentage: 25 },
        employee1.id
      )
    ).rejects.toThrowError(/Task must be started before updating progress/i);
  });

  // 17. Employee cannot directly mark task COMPLETED, and Admin can only mark COMPLETED after review submission
  it('17. Enforces review submission before Approve & Complete on backend', async () => {
    const dueTomorrow = new Date(Date.now() + 86400000);
    const inProgressTask = {
      id: 'task_review_flow',
      title: 'Final Ad Creatives',
      clientId: 'client_nike_001',
      assignedToId: employee1.id,
      reviewerId: adminUser.id,
      status: TaskStatus.IN_PROGRESS,
      completionPercentage: 75,
      startedAt: new Date(),
      startedById: employee1.id,
      dueDate: dueTomorrow,
    };

    // 1. Employee tries to mark COMPLETED directly -> 403
    vi.spyOn(prisma.task, 'findUnique').mockResolvedValueOnce(inProgressTask as any);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(employee1 as any);
    await expect(
      TaskService.updateTaskStatus(
        'task_review_flow',
        { status: TaskStatus.COMPLETED, completionPercentage: 100 },
        employee1.id
      )
    ).rejects.toThrowError(/Only Admin or the assigned Reviewer can approve and complete a task/i);

    // 2. Admin tries to mark COMPLETED while task is still IN_PROGRESS (75%, not submitted for review) -> 400
    vi.spyOn(prisma.task, 'findUnique').mockResolvedValueOnce(inProgressTask as any);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(adminUser as any);
    await expect(
      TaskService.updateTaskStatus(
        'task_review_flow',
        { status: TaskStatus.COMPLETED, completionPercentage: 100 },
        adminUser.id
      )
    ).rejects.toThrowError(/Task can only be approved and completed after it has reached 100% progress and been submitted for review/i);

    // 3. Task is now in INTERNAL_REVIEW at 100% -> Admin marks COMPLETED -> succeeds
    vi.spyOn(prisma.task, 'findUnique').mockResolvedValueOnce({
      ...inProgressTask,
      status: TaskStatus.INTERNAL_REVIEW,
      completionPercentage: 100,
    } as any);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(adminUser as any);
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as any);
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) =>
      callback({
        task: {
          update: vi.fn().mockResolvedValue({
            id: 'task_review_flow',
            status: TaskStatus.COMPLETED,
            completionPercentage: 100,
            completedAt: new Date(),
            dueDate: dueTomorrow,
          }),
        },
        taskComment: { create: vi.fn() },
        clientService: { updateMany: vi.fn() },
      })
    );

    const completed = await TaskService.updateTaskStatus(
      'task_review_flow',
      { status: TaskStatus.COMPLETED, completionPercentage: 100 },
      adminUser.id
    );
    expect(completed.status).toBe(TaskStatus.COMPLETED);
    expect(completed.completionPercentage).toBe(100);
  });

  // 18. Proof of Work attachment access and physical file resolution for Aura Anenue splash.png
  it('18. Resolves Aura Anenue splash.png attachment for Admin and assigned employee while blocking unassigned employees', async () => {
    const auraTask = {
      id: 'cmv67kqir001jae5tj91koym0',
      title: 'Initial Deliverables: Web Development setup',
      clientId: 'cmv679krs0012ae5th73w9o0r',
      assignedToId: employee1.id,
      status: TaskStatus.IN_PROGRESS,
      completionPercentage: 75,
      dueDate: new Date(Date.now() + 86400000),
      attachments: [
        {
          id: 'cmv6a11sd0005dz0zxt7zd083',
          taskId: 'cmv67kqir001jae5tj91koym0',
          fileName: 'splash.png',
          fileUrl: '/uploads/1791871504626-712338704-splash.png',
          fileType: 'image/png',
          fileSize: 1309353,
          uploadedById: employee1.id,
          uploadedBy: { id: employee1.id, fullName: 'Sukh', role: 'EMPLOYEE' },
        },
      ],
    };

    vi.spyOn(prisma.task, 'findUnique').mockResolvedValue(auraTask as any);

    // Admin can access attachment and resolve file on disk
    const adminAccess = await TaskService.getTaskAttachmentForAccess(
      'cmv67kqir001jae5tj91koym0',
      'cmv6a11sd0005dz0zxt7zd083',
      { id: adminUser.id, role: 'ADMIN' }
    );
    expect(adminAccess.attachment.fileName).toBe('splash.png');
    expect(adminAccess.attachment.fileType).toBe('image/png');
    expect(adminAccess.filePath).toContain('1791871504626-712338704-splash.png');

    // Unassigned employee2 is blocked with 403 FORBIDDEN
    vi.spyOn(prisma.clientAssignedEmployee, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma.clientService, 'findFirst').mockResolvedValue(null);
    await expect(
      TaskService.getTaskAttachmentForAccess(
        'cmv67kqir001jae5tj91koym0',
        'cmv6a11sd0005dz0zxt7zd083',
        { id: employee2.id, role: 'EMPLOYEE' }
      )
    ).rejects.toThrowError(/cannot access tasks for this client/i);
  });
});



