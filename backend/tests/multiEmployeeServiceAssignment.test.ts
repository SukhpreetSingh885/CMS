import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db.js';
import { ClientService } from '../src/services/client.service.js';
import { TaskService } from '../src/services/task.service.js';
import { DashboardService } from '../src/services/dashboard.service.js';
import { DailyReportService } from '../src/services/dailyReport.service.js';
import { Role, UserStatus, BillingCycle, ClientStatus } from '@prisma/client';

describe('Viralstan CMS — 3-Stage Workflow: Client First, Employees Second, Tasks Third', () => {
  const suffix = `mteam_${Date.now()}`;
  let adminId = '';
  let empWeb1Id = '';
  let empWeb2Id = '';
  let empSeo1Id = '';
  let disabledEmpId = '';
  let svcWebId = '';
  let svcSeoId = '';
  let svcDesignId = '';
  let pkgId = '';
  let client1Id = '';
  let client2Id = '';

  beforeAll(async () => {
    await ClientService.syncEmployeeClientAssignments();

    const admin = await prisma.user.create({
      data: {
        email: `admin_${suffix}@viralstan.com`,
        password: 'hashed_password',
        fullName: `Admin ${suffix}`,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
    adminId = admin.id;

    const [emp1, emp2, emp3, empDisabled] = await Promise.all([
      prisma.user.create({
        data: {
          email: `sukh_${suffix}@viralstan.com`,
          password: 'hashed_password',
          fullName: `Sukh ${suffix}`,
          role: Role.EMPLOYEE,
          designation: 'Web Developer',
          department: 'Engineering',
          status: UserStatus.ACTIVE,
        },
      }),
      prisma.user.create({
        data: {
          email: `rahul_${suffix}@viralstan.com`,
          password: 'hashed_password',
          fullName: `Rahul ${suffix}`,
          role: Role.EMPLOYEE,
          designation: 'Full Stack & SEO Specialist',
          department: 'Growth',
          status: UserStatus.ACTIVE,
        },
      }),
      prisma.user.create({
        data: {
          email: `priya_${suffix}@viralstan.com`,
          password: 'hashed_password',
          fullName: `Priya ${suffix}`,
          role: Role.EMPLOYEE,
          designation: 'SEO Specialist',
          department: 'Marketing',
          status: UserStatus.ACTIVE,
        },
      }),
      prisma.user.create({
        data: {
          email: `disabled_${suffix}@viralstan.com`,
          password: 'hashed_password',
          fullName: `Disabled User ${suffix}`,
          role: Role.EMPLOYEE,
          designation: 'Former Staff',
          status: UserStatus.DISABLED,
        },
      }),
    ]);

    empWeb1Id = emp1.id;
    empWeb2Id = emp2.id;
    empSeo1Id = emp3.id;
    disabledEmpId = empDisabled.id;

    const [svcWeb, svcSeo, svcDesign] = await Promise.all([
      prisma.service.create({
        data: {
          name: `Web Development ${suffix}`,
          description: 'Full-stack web development',
          isActive: true,
        },
      }),
      prisma.service.create({
        data: {
          name: `SEO ${suffix}`,
          description: 'Search engine optimization',
          isActive: true,
        },
      }),
      prisma.service.create({
        data: {
          name: `Graphic Designing ${suffix}`,
          description: 'Brand identity and creatives',
          isActive: true,
        },
      }),
    ]);

    svcWebId = svcWeb.id;
    svcSeoId = svcSeo.id;
    svcDesignId = svcDesign.id;

    const pkg = await prisma.package.create({
      data: {
        name: `Growth Business Package ${suffix}`,
        packageType: 'COMBINED_BUSINESS',
        basePrice: 150000,
        billingCycle: BillingCycle.MONTHLY,
        isActive: true,
        packageServices: {
          create: [
            { serviceId: svcWebId, monthlyTarget: 5, defaultWeight: 1.5, deliverables: '5 Landing Pages' },
            { serviceId: svcSeoId, monthlyTarget: 20, defaultWeight: 1.0, deliverables: '20 Backlinks' },
            { serviceId: svcDesignId, monthlyTarget: 15, defaultWeight: 1.0, deliverables: '15 Creatives' },
          ],
        },
      },
    });
    pkgId = pkg.id;
  });

  afterAll(async () => {
    try {
      if (client1Id) {
        await ClientService.deleteClientPermanent(client1Id, 'DELETE', adminId).catch(() => {});
      }
      if (client2Id) {
        await ClientService.deleteClientPermanent(client2Id, 'DELETE', adminId).catch(() => {});
      }
      if (pkgId) {
        await prisma.package.deleteMany({ where: { id: pkgId } });
      }
      await prisma.service.deleteMany({
        where: { id: { in: [svcWebId, svcSeoId, svcDesignId].filter(Boolean) } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [adminId, empWeb1Id, empWeb2Id, empSeo1Id, disabledEmpId].filter(Boolean) } },
      });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('1. Stage 1: Creates a client with package and multiple services without any employees, and verifies 0 tasks are automatically created and 0 employees see the unassigned client', async () => {
    const now = new Date();
    const end = new Date(Date.now() + 90 * 86400000);

    const onboarded = await ClientService.createClient(
      {
        companyName: `Aura Avenue ${suffix}`,
        contactPerson: 'Aarav Mehta',
        mobileNumber: '+91 9876543210',
        email: `aura_${suffix}@example.com`,
        contractStartDate: now.toISOString(),
        contractEndDate: end.toISOString(),
        renewalDate: end.toISOString(),
        assignedAdminId: adminId,
        packageId: pkgId,
        packagePricing: 150000,
        billingCycle: BillingCycle.MONTHLY,
        status: ClientStatus.ACTIVE,
        generateFirstInvoice: false,
        services: [
          { serviceId: svcWebId, monthlyTarget: 5, serviceWeight: 1.5, deliverables: '5 Landing Pages' },
          { serviceId: svcSeoId, monthlyTarget: 20, serviceWeight: 1.0, deliverables: '20 Backlinks' },
          { serviceId: svcDesignId, monthlyTarget: 15, serviceWeight: 1.0, deliverables: '15 Creatives' },
        ],
      },
      adminId
    );

    client1Id = onboarded.id;

    // Fetch full client 360 profile as Admin
    const detail = await ClientService.getClientById(client1Id, { id: adminId, role: 'ADMIN' });
    expect(detail.services).toHaveLength(3);

    // Verify 0 tasks were automatically created during onboarding
    expect(detail.tasks).toHaveLength(0);

    // Verify 0 employees are assigned initially
    expect(detail.assignedEmployees).toHaveLength(0);
    for (const s of detail.services) {
      expect(s.assignedEmployees).toHaveLength(0);
    }

    // Verify no employee sees the unassigned client in My Assigned Clients
    const [sukhClients, rahulClients, priyaClients] = await Promise.all([
      ClientService.listClients({ assignedEmployeeId: empWeb1Id }),
      ClientService.listClients({ assignedEmployeeId: empWeb2Id }),
      ClientService.listClients({ assignedEmployeeId: empSeo1Id }),
    ]);
    expect(sukhClients.clients.some((c: any) => c.id === client1Id)).toBe(false);
    expect(rahulClients.clients.some((c: any) => c.id === client1Id)).toBe(false);
    expect(priyaClients.clients.some((c: any) => c.id === client1Id)).toBe(false);
  });

  it('2. Stage 2: Assigns multiple employees to Service 1 (Web Development) and Service 2 (SEO) via updateClientServiceTeam', async () => {
    const detail = await ClientService.getClientById(client1Id, { id: adminId, role: 'ADMIN' });
    const webClientSvc = detail.services.find((s: any) => s.serviceId === svcWebId)!;
    const seoClientSvc = detail.services.find((s: any) => s.serviceId === svcSeoId)!;
    const designClientSvc = detail.services.find((s: any) => s.serviceId === svcDesignId)!;

    // Reject disabled employee
    await expect(
      ClientService.updateClientServiceTeam(client1Id, designClientSvc.id, [disabledEmpId], adminId)
    ).rejects.toThrowError(/invalid, disabled, or not authorized/i);

    // Assign Sukh & Rahul to Web Development (with duplicate ID to test deduplication)
    const updatedWeb = await ClientService.updateClientServiceTeam(
      client1Id,
      webClientSvc.id,
      [empWeb1Id, empWeb2Id, empWeb1Id],
      adminId
    );
    expect(updatedWeb.assignedEmployees).toHaveLength(2);
    expect(updatedWeb.assignedEmployees.map((ae: any) => ae.employee.id)).toEqual(
      expect.arrayContaining([empWeb1Id, empWeb2Id])
    );

    // Assign Priya & Rahul to SEO
    const updatedSeo = await ClientService.updateClientServiceTeam(
      client1Id,
      seoClientSvc.id,
      [empSeo1Id, empWeb2Id],
      adminId
    );
    expect(updatedSeo.assignedEmployees).toHaveLength(2);
    expect(updatedSeo.assignedEmployees.map((ae: any) => ae.employee.id)).toEqual(
      expect.arrayContaining([empSeo1Id, empWeb2Id])
    );

    // Graphic Designing remains unassigned
    const afterDetail = await ClientService.getClientById(client1Id, { id: adminId, role: 'ADMIN' });
    expect(afterDetail.assignedEmployees.map((ae: any) => ae.userId)).toEqual(
      expect.arrayContaining([empWeb1Id, empWeb2Id, empSeo1Id])
    );
  });

  it('3. Stage 2 Verification: Assigned employees immediately see the client and only their assigned services, while confidential financial fields are stripped', async () => {
    // Check Rahul (assigned to BOTH Web Development and SEO on Aura Avenue)
    const rahulDashboard = await DashboardService.getEmployeeDashboard(empWeb2Id);
    expect(rahulDashboard.kpis.assignedClientsCount).toBeGreaterThanOrEqual(1);

    const auraOnDashboard = rahulDashboard.sections.assignedClients.find((c: any) => c.id === client1Id);
    expect(auraOnDashboard).toBeDefined();
    expect(auraOnDashboard!.myServices).toHaveLength(2);
    expect(auraOnDashboard!.myServices.map((ms: any) => ms.serviceId)).toEqual(
      expect.arrayContaining([svcWebId, svcSeoId])
    );

    // Check Sukh (assigned ONLY to Web Development)
    const sukhDashboard = await DashboardService.getEmployeeDashboard(empWeb1Id);
    const auraForSukh = sukhDashboard.sections.assignedClients.find((c: any) => c.id === client1Id);
    expect(auraForSukh).toBeDefined();
    expect(auraForSukh!.myServices).toHaveLength(1);
    expect(auraForSukh!.myServices[0].serviceId).toBe(svcWebId);

    // Check Sukh can view client by ID and confidential financial data is stripped
    const clientViewBySukh: any = await ClientService.getClientById(client1Id, {
      id: empWeb1Id,
      role: 'EMPLOYEE',
    });
    expect(clientViewBySukh.id).toBe(client1Id);
    expect(clientViewBySukh.packagePricing).toBeUndefined();
    expect(clientViewBySukh.contractSnapshot).toBeUndefined();
    expect(clientViewBySukh.invoices).toEqual([]);
    expect(clientViewBySukh.payments).toEqual([]);

    // Check Sukh can submit a daily report for Web Development
    const report = await DailyReportService.createReport(
      {
        clientId: client1Id,
        serviceId: svcWebId,
        workDescription: 'Built responsive hero section',
        workCompleted: 'Completed landing page header',
        hoursSpent: 4,
      },
      empWeb1Id
    );
    expect(report.clientId).toBe(client1Id);
  });

  it('4. Stage 3: Creates separate tasks for Employee 1 (Sukh) and Employee 2 (Rahul) under Service 1, verifies each employee sees only their own task in My Tasks, and rejects employee task creation for unassigned services', async () => {
    const dueDate = new Date(Date.now() + 5 * 86400000).toISOString();

    // Attempting to create an employee task for Graphic Designing (unassigned service) must fail
    await expect(
      TaskService.createTask(
        {
          title: 'Design 5 Ad Creatives',
          clientId: client1Id,
          serviceId: svcDesignId,
          assignedToId: empWeb1Id,
          priority: 'MEDIUM',
          dueDate,
        },
        adminId
      )
    ).rejects.toThrowError(/No employees assigned to this service/i);

    // Attempting to assign a Web Development task to Priya (who is on SEO, not Web Development) must fail
    await expect(
      TaskService.createTask(
        {
          title: 'Build Checkout Flow',
          clientId: client1Id,
          serviceId: svcWebId,
          assignedToId: empSeo1Id,
          priority: 'HIGH',
          dueDate,
        },
        adminId
      )
    ).rejects.toThrowError(/not assigned to this client service team/i);

    // Create Task 1 for Sukh under Web Development
    const taskSukh = await TaskService.createTask(
      {
        title: `Build Homepage UI ${suffix}`,
        clientId: client1Id,
        serviceId: svcWebId,
        assignedToId: empWeb1Id,
        priority: 'HIGH',
        dueDate,
      },
      adminId
    );

    // Create Task 2 for Rahul under Web Development
    const taskRahul = await TaskService.createTask(
      {
        title: `Build Contact Form & Speed Optimization ${suffix}`,
        clientId: client1Id,
        serviceId: svcWebId,
        assignedToId: empWeb2Id,
        priority: 'MEDIUM',
        dueDate,
      },
      adminId
    );

    // Verify Sukh's My Tasks contains only Sukh's task, NOT Rahul's task
    const sukhTasks = await TaskService.listTasks({
      assignedToId: empWeb1Id,
      clientId: client1Id,
    });
    expect(sukhTasks.tasks.map((t: any) => t.id)).toContain(taskSukh.id);
    expect(sukhTasks.tasks.map((t: any) => t.id)).not.toContain(taskRahul.id);

    // Verify Rahul's My Tasks contains only Rahul's task, NOT Sukh's task
    const rahulTasks = await TaskService.listTasks({
      assignedToId: empWeb2Id,
      clientId: client1Id,
    });
    expect(rahulTasks.tasks.map((t: any) => t.id)).toContain(taskRahul.id);
    expect(rahulTasks.tasks.map((t: any) => t.id)).not.toContain(taskSukh.id);
  });

  it('5. Removing an employee from all services on a client removes the client from their My Assigned Clients', async () => {
    const detail = await ClientService.getClientById(client1Id, { id: adminId, role: 'ADMIN' });
    const seoClientSvc = detail.services.find((s: any) => s.serviceId === svcSeoId)!;

    // Remove Priya from SEO (leaving only Rahul on SEO)
    await ClientService.updateClientServiceTeam(client1Id, seoClientSvc.id, [empWeb2Id], adminId);

    const priyaClients = await ClientService.listClients({ assignedEmployeeId: empSeo1Id });
    expect(priyaClients.clients.some((c: any) => c.id === client1Id)).toBe(false);
  });

  it('6. Legacy single-employee ClientService.assignedEmployeeId is preserved and backfilled by syncEmployeeClientAssignments', async () => {
    const now = new Date();
    const end = new Date(Date.now() + 60 * 86400000);

    const legacyClient = await prisma.client.create({
      data: {
        companyName: `Legacy Brand ${suffix}`,
        contactPerson: 'Vikram Singh',
        mobileNumber: '+91 9123456780',
        email: `legacy_${suffix}@example.com`,
        contractStartDate: now,
        contractEndDate: end,
        renewalDate: end,
        assignedAdminId: adminId,
        status: ClientStatus.ACTIVE,
      },
    });
    client2Id = legacyClient.id;

    await prisma.clientService.create({
      data: {
        clientId: client2Id,
        serviceId: svcSeoId,
        assignedEmployeeId: empSeo1Id,
        monthlyTarget: 10,
      },
    });

    await ClientService.syncEmployeeClientAssignments(empSeo1Id);

    const priyaClients = await ClientService.listClients({ assignedEmployeeId: empSeo1Id });
    const foundLegacy = priyaClients.clients.find((c: any) => c.id === client2Id);
    expect(foundLegacy).toBeDefined();
    expect(foundLegacy!.services[0].assignedEmployees).toHaveLength(1);
    expect(foundLegacy!.services[0].assignedEmployees[0].employee.id).toBe(empSeo1Id);
  });
});

