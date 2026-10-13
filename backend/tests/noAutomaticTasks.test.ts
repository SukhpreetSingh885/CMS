import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db.js';
import { ClientService } from '../src/services/client.service.js';
import { TaskService } from '../src/services/task.service.js';
import { PackageService } from '../src/services/package.service.js';
import { TaskStatus, Priority } from '@prisma/client';

describe('VIRALSTAN CMS — ZERO AUTOMATIC TASK CREATION & SAFE TASK DELETION TESTS', () => {
  let adminUser: any;
  let employeeA: any;
  let employeeB: any;
  let testPackage: any;
  let testService1: any;
  let testService2: any;
  let createdClientId: string;

  beforeAll(async () => {
    // 1. Get or create Admin
    adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: `admin_${Date.now()}@viralstan.com`,
          password: 'hashed_password_test',
          fullName: 'Test Master Admin',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });
    }

    // 2. Create test employees
    employeeA = await prisma.user.create({
      data: {
        email: `emp_a_${Date.now()}@viralstan.com`,
        password: 'hashed_password_test',
        fullName: 'Employee Developer A',
        role: 'EMPLOYEE',
        designation: 'Senior Web Developer',
        status: 'ACTIVE',
      },
    });

    employeeB = await prisma.user.create({
      data: {
        email: `emp_b_${Date.now()}@viralstan.com`,
        password: 'hashed_password_test',
        fullName: 'Employee Specialist B',
        role: 'EMPLOYEE',
        designation: 'SEO Specialist',
        status: 'ACTIVE',
      },
    });

    // 3. Create test services
    testService1 = await prisma.service.create({
      data: {
        name: `Web Development_${Date.now()}`,
        description: 'Custom Next.js & React Development',
        isActive: true,
      },
    });

    testService2 = await prisma.service.create({
      data: {
        name: `SEO Optimization_${Date.now()}`,
        description: 'Technical and On-Page SEO',
        isActive: true,
      },
    });

    // 4. Create package with deliverables list
    testPackage = await prisma.package.create({
      data: {
        name: `Enterprise Growth Plan_${Date.now()}`,
        basePrice: 50000,
        billingCycle: 'MONTHLY',
        packageType: 'COMBINED_BUSINESS',
        packageServices: {
          create: [
            {
              serviceId: testService1.id,
              monthlyTarget: 10,
              defaultWeight: 1.0,
              deliverables: '10 Web Pages, 1 Contact Form',
              deliverablesList: {
                create: [
                  {
                    name: 'Website Pages',
                    deliverableType: 'QUANTITY',
                    quantity: 10,
                    unit: 'pages',
                    targetPeriod: 'MONTHLY',
                  },
                  {
                    name: 'Contact Form',
                    deliverableType: 'FEATURE',
                    isIncluded: true,
                  },
                ],
              },
            },
            {
              serviceId: testService2.id,
              monthlyTarget: 5,
              defaultWeight: 1.0,
              deliverables: '5 Technical Audits',
            },
          ],
        },
      },
      include: {
        packageServices: true,
      },
    });
  });

  afterAll(async () => {
    // Clean up created test entities
    if (createdClientId) {
      const clientTasks = await prisma.task.findMany({ where: { clientId: createdClientId } });
      const tIds = clientTasks.map((t) => t.id);
      if (tIds.length > 0) {
        await prisma.taskComment.deleteMany({ where: { taskId: { in: tIds } } });
        await prisma.taskAttachment.deleteMany({ where: { taskId: { in: tIds } } });
        await prisma.task.deleteMany({ where: { id: { in: tIds } } });
      }
      await prisma.clientServiceEmployeeAssignment.deleteMany({ where: { clientService: { clientId: createdClientId } } });
      await prisma.clientAssignedEmployee.deleteMany({ where: { clientId: createdClientId } });
      await prisma.clientService.deleteMany({ where: { clientId: createdClientId } });
      await prisma.renewal.deleteMany({ where: { clientId: createdClientId } });
      await prisma.invoice.deleteMany({ where: { clientId: createdClientId } });
      await prisma.client.deleteMany({ where: { id: createdClientId } });
    }

    if (testPackage) {
      await prisma.packageDeliverable.deleteMany({ where: { packageService: { packageId: testPackage.id } } });
      await prisma.packageService.deleteMany({ where: { packageId: testPackage.id } });
      await prisma.package.deleteMany({ where: { id: testPackage.id } });
    }

    if (testService1) await prisma.service.deleteMany({ where: { id: testService1.id } });
    if (testService2) await prisma.service.deleteMany({ where: { id: testService2.id } });
    if (employeeA) await prisma.user.deleteMany({ where: { id: employeeA.id } });
    if (employeeB) await prisma.user.deleteMany({ where: { id: employeeB.id } });
  });

  it('1. Creating a new client with a package and multiple deliverables creates ZERO tasks', async () => {
    const client = await ClientService.createClient(
      {
        companyName: `Zero Tasks Corp_${Date.now()}`,
        contactPerson: 'Alex Rivera',
        email: `contact_${Date.now()}@zerotasks.com`,
        mobileNumber: '+91 9999988888',
        packageId: testPackage.id,
        packagePricing: 50000,
        billingCycle: 'MONTHLY',
        contractStartDate: new Date().toISOString().slice(0, 10),
        contractEndDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
        renewalDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
        services: [
          {
            serviceId: testService1.id,
            monthlyTarget: 10,
            serviceWeight: 1.0,
            deliverables: '10 Website Pages, 1 Contact Form',
          },
          {
            serviceId: testService2.id,
            monthlyTarget: 5,
            serviceWeight: 1.0,
            deliverables: '5 Technical Audits',
          },
        ],
      },
      adminUser.id
    );

    createdClientId = client.id;
    expect(client.id).toBeDefined();

    // Verify task count is STRICTLY ZERO
    const tasksCount = await prisma.task.count({
      where: { clientId: client.id },
    });
    expect(tasksCount).toBe(0);

    // Verify package deliverables exist in contract snapshot, but zero tasks generated
    const savedClient = await ClientService.getClientById(client.id, adminUser);
    expect(savedClient.tasks).toHaveLength(0);
  });

  it('2. Assigning multiple employees to client services creates ZERO tasks', async () => {
    const client = await ClientService.getClientById(createdClientId, adminUser);
    const clientSvc1 = client.services.find((s: any) => s.serviceId === testService1.id);
    expect(clientSvc1).toBeDefined();

    // Assign Employee A and Employee B to Service 1
    const updatedSvc = await ClientService.updateClientServiceTeam(
      createdClientId,
      clientSvc1.id,
      [employeeA.id, employeeB.id],
      adminUser.id
    );

    expect(updatedSvc).toBeDefined();

    // Verify task count is STILL ZERO
    const tasksAfterAssign = await prisma.task.count({
      where: { clientId: createdClientId },
    });
    expect(tasksAfterAssign).toBe(0);
  });

  it('3. Employees assigned to services see the client under My Clients, but have 0 assigned tasks', async () => {
    // Check Employee A's assigned clients
    await ClientService.syncEmployeeClientAssignments(employeeA.id);
    const myClientsA = await ClientService.listClients({
      assignedEmployeeId: employeeA.id,
    } as any);

    expect(myClientsA.clients.some((c: any) => c.id === createdClientId)).toBe(true);

    // Check Employee A's tasks: must be completely empty (0 tasks)
    const empATasks = await TaskService.listTasks({
      assignedToId: employeeA.id,
    });
    expect(empATasks.tasks).toHaveLength(0);
    expect(empATasks.total).toBe(0);
  });

  it('4. Updating client information or changing package pricing creates ZERO tasks', async () => {
    await ClientService.updateClient(
      createdClientId,
      {
        companyName: 'Zero Tasks Corp Updated',
        packagePricing: 60000,
      },
      adminUser.id
    );

    const tasksCount = await prisma.task.count({
      where: { clientId: createdClientId },
    });
    expect(tasksCount).toBe(0);
  });

  it('5. Manual task creation: Admin explicitly creates a task, and it appears only for the assigned employee', async () => {
    const manualTask = await TaskService.createTask(
      {
        clientId: createdClientId,
        serviceId: testService1.id,
        assignedToId: employeeA.id,
        title: 'Manually Created Landing Page Design',
        description: 'Design the hero section and pricing table',
        dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        priority: Priority.HIGH,
      },
      adminUser.id
    );

    expect(manualTask.id).toBeDefined();
    expect(manualTask.title).toBe('Manually Created Landing Page Design');
    expect(manualTask.assignedToId).toBe(employeeA.id);

    // Verify exactly 1 task exists for this client
    const tasksCount = await prisma.task.count({
      where: { clientId: createdClientId },
    });
    expect(tasksCount).toBe(1);

    // Verify Employee A now sees exactly 1 task
    const empATasks = await TaskService.listTasks({
      assignedToId: employeeA.id,
    });
    expect(empATasks.tasks).toHaveLength(1);
    expect(empATasks.tasks[0].id).toBe(manualTask.id);

    // Verify Employee B still sees 0 tasks
    const empBTasks = await TaskService.listTasks({
      assignedToId: employeeB.id,
    });
    expect(empBTasks.tasks).toHaveLength(0);
  });

  it('6. Admin self-assignment of tasks is preserved and works correctly', async () => {
    const adminSelfTask = await TaskService.createTask(
      {
        clientId: createdClientId,
        assignedToId: adminUser.id,
        title: 'Executive Contract Review by Admin',
        dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
        priority: Priority.URGENT,
      },
      adminUser.id
    );

    expect(adminSelfTask.id).toBeDefined();
    expect(adminSelfTask.assignedToId).toBe(adminUser.id);
  });

  it('7. Safe task deletion: deletes task transactionally, requires DELETE confirmation if sensitive, and cleans up audit trail', async () => {
    // Create a temporary task with a comment to test sensitive confirmation requirement
    const taskToDelete = await TaskService.createTask(
      {
        clientId: createdClientId,
        serviceId: testService1.id,
        assignedToId: employeeA.id,
        title: 'Legacy Setup Task To Delete',
        dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      },
      adminUser.id
    );

    // Add a comment to make it have history
    await TaskService.addComment(taskToDelete.id, employeeA.id, 'Employee work comment');

    // Attempting deletion without confirmation text must fail with 400
    await expect(
      TaskService.deleteTask(taskToDelete.id, adminUser.id)
    ).rejects.toThrow(/DELETE/i);

    // Confirm deletion with "DELETE"
    const deleteResult = await TaskService.deleteTask(taskToDelete.id, adminUser.id, {
      confirmation: 'DELETE',
    });

    expect(deleteResult.deleted).toBe(true);
    expect(deleteResult.commentsRemoved).toBe(1);

    // Verify task is gone from MySQL
    const checkDeleted = await prisma.task.findUnique({
      where: { id: taskToDelete.id },
    });
    expect(checkDeleted).toBeNull();

    // Verify audit log exists
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: 'TASK_DELETED',
        resourceId: taskToDelete.id,
      },
    });
    expect(auditLog).toBeDefined();
    expect(auditLog?.actorId).toBe(adminUser.id);
  });
});
