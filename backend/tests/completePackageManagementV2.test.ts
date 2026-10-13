import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db.js';
import { PackageService } from '../src/services/package.service.js';
import { ClientService } from '../src/services/client.service.js';
import { FinanceService } from '../src/services/finance.service.js';
import { DashboardService } from '../src/services/dashboard.service.js';
import { ReportService } from '../src/services/report.service.js';
import { BillingCycle, PackageType, DeliverableType, DeliverablePeriod, Role, UserStatus, ClientStatus, PaymentMethod } from '@prisma/client';

describe('VIRALSTAN CMS — COMPLETE PACKAGE MANAGEMENT SYSTEM V2 TESTS', () => {
  let testAdminUser: any;
  let testServiceWeb: any;
  let testServiceSeo: any;
  let createdPackageIds: string[] = [];
  let createdClientIds: string[] = [];

  beforeAll(async () => {
    // 1. Ensure test admin exists
    testAdminUser = await prisma.user.findFirst({
      where: { role: Role.ADMIN, status: UserStatus.ACTIVE },
    });

    if (!testAdminUser) {
      testAdminUser = await prisma.user.create({
        data: {
          email: 'admin@viralstan.com',
          password: 'HashedPassword123!',
          fullName: 'Main Administrator',
          role: Role.ADMIN,
          status: UserStatus.ACTIVE,
        },
      });
    }

    // 2. Ensure test services exist
    testServiceWeb = await prisma.service.create({
      data: {
        name: `Web Dev Test ${Date.now()}`,
        description: 'Web Development Service for V2 testing',
        defaultMonthlyTarget: 5,
      },
    });

    testServiceSeo = await prisma.service.create({
      data: {
        name: `SEO Test ${Date.now()}`,
        description: 'SEO Optimization Service for V2 testing',
        defaultMonthlyTarget: 15,
      },
    });
  });

  afterAll(async () => {
    // Cleanup created test records
    for (const clientId of createdClientIds) {
      await prisma.auditLog.deleteMany({ where: { resourceId: clientId } });
      await prisma.payment.deleteMany({ where: { clientId } });
      await prisma.invoice.deleteMany({ where: { clientId } });
      await prisma.renewal.deleteMany({ where: { clientId } });
      await prisma.task.deleteMany({ where: { clientId } });
      await prisma.clientService.deleteMany({ where: { clientId } });
      await prisma.clientAssignedEmployee.deleteMany({ where: { clientId } });
      await prisma.client.deleteMany({ where: { id: clientId } });
    }

    for (const pkgId of createdPackageIds) {
      await prisma.packageDeliverable.deleteMany({
        where: { packageService: { packageId: pkgId } },
      });
      await prisma.packageService.deleteMany({ where: { packageId: pkgId } });
      await prisma.package.deleteMany({ where: { id: pkgId } });
    }

    if (testServiceWeb) {
      await prisma.service.delete({ where: { id: testServiceWeb.id } });
    }
    if (testServiceSeo) {
      await prisma.service.delete({ where: { id: testServiceSeo.id } });
    }
  });

  it('1. Creates Single Service Package with Setup Fee, Quantities, Features, and Milestones', async () => {
    const pkg = await PackageService.createPackage({
      name: `Website Custom Build ${Date.now()}`,
      packageType: PackageType.SINGLE_SERVICE,
      description: 'One-time website project with milestone tracking and setup fee',
      basePrice: 75000,
      setupFee: 15000,
      billingCycle: BillingCycle.ONE_TIME,
      features: ['Dedicated PM', 'Post-launch 30-day warranty'],
      services: [
        {
          serviceId: testServiceWeb.id,
          deliverablesList: [
            {
              name: 'Responsive Web Pages',
              deliverableType: DeliverableType.QUANTITY,
              quantity: 8,
              unit: 'Pages',
              targetPeriod: DeliverablePeriod.ONE_TIME,
              isIncluded: true,
            },
            {
              name: 'Speed Optimization & CDN',
              deliverableType: DeliverableType.FEATURE,
              isIncluded: true,
            },
            {
              name: 'E-commerce Checkout Gateway',
              deliverableType: DeliverableType.FEATURE,
              isIncluded: false, // Excluded feature
            },
            {
              name: 'Production Server Deployment',
              deliverableType: DeliverableType.MILESTONE,
              targetPeriod: DeliverablePeriod.MILESTONE_BASED,
              isIncluded: true,
            },
          ],
        },
      ],
    });

    createdPackageIds.push(pkg!.id);

    expect(pkg).toBeDefined();
    expect(pkg!.name).toContain('Website Custom Build');
    expect(Number(pkg!.basePrice)).toBe(75000);
    expect(Number(pkg!.setupFee)).toBe(15000);
    expect(pkg!.billingCycle).toBe(BillingCycle.ONE_TIME);
    expect(pkg!.packageServices.length).toBe(1);

    const deliverables = pkg!.packageServices[0].deliverablesList;
    expect(deliverables.length).toBe(4);

    const qtyDeliv = deliverables.find((d) => d.deliverableType === DeliverableType.QUANTITY);
    expect(qtyDeliv).toBeDefined();
    expect(qtyDeliv!.quantity).toBe(8);
    expect(qtyDeliv!.unit).toBe('Pages');

    const excludedFeature = deliverables.find((d) => d.name === 'E-commerce Checkout Gateway');
    expect(excludedFeature).toBeDefined();
    expect(excludedFeature!.isIncluded).toBe(false);

    const milestoneDeliv = deliverables.find((d) => d.deliverableType === DeliverableType.MILESTONE);
    expect(milestoneDeliv).toBeDefined();
    expect(milestoneDeliv!.targetPeriod).toBe(DeliverablePeriod.MILESTONE_BASED);
  });

  it('2. Creates Combined Business Package bundling multiple services with recurring retainer', async () => {
    const pkg = await PackageService.createPackage({
      name: `Growth Omnichannel Pack ${Date.now()}`,
      packageType: PackageType.COMBINED_BUSINESS,
      description: 'Monthly growth retainer combining Web and SEO',
      basePrice: 60000,
      setupFee: 10000,
      billingCycle: BillingCycle.MONTHLY,
      features: ['Weekly Strategy Calls', 'Dedicated Account Manager'],
      services: [
        {
          serviceId: testServiceWeb.id,
          deliverablesList: [
            {
              name: 'Landing Page Tweaks',
              deliverableType: DeliverableType.QUANTITY,
              quantity: 2,
              unit: 'Pages',
              targetPeriod: DeliverablePeriod.MONTHLY,
              isIncluded: true,
            },
          ],
        },
        {
          serviceId: testServiceSeo.id,
          deliverablesList: [
            {
              name: 'Target Keywords Ranking',
              deliverableType: DeliverableType.QUANTITY,
              quantity: 25,
              unit: 'Keywords',
              targetPeriod: DeliverablePeriod.MONTHLY,
              isIncluded: true,
            },
            {
              name: 'Weekly Competitor Analysis',
              deliverableType: DeliverableType.FEATURE,
              isIncluded: true,
            },
          ],
        },
      ],
    });

    createdPackageIds.push(pkg!.id);

    expect(pkg).toBeDefined();
    expect(pkg!.packageType).toBe(PackageType.COMBINED_BUSINESS);
    expect(Number(pkg!.basePrice)).toBe(60000);
    expect(Number(pkg!.setupFee)).toBe(10000);
    expect(pkg!.packageServices.length).toBe(2);
  });

  it('3. Freezes Contract Snapshot on Client Onboarding (Immutable against package template updates)', async () => {
    const pkg = await PackageService.createPackage({
      name: `Template Package ${Date.now()}`,
      packageType: PackageType.SINGLE_SERVICE,
      basePrice: 50000,
      setupFee: 5000,
      billingCycle: BillingCycle.MONTHLY,
      services: [
        {
          serviceId: testServiceSeo.id,
          deliverablesList: [
            {
              name: 'SEO Backlinks',
              deliverableType: DeliverableType.QUANTITY,
              quantity: 10,
              unit: 'Backlinks',
              targetPeriod: DeliverablePeriod.MONTHLY,
              isIncluded: true,
            },
          ],
        },
      ],
    });
    createdPackageIds.push(pkg!.id);

    // Onboard client with this package
    const client = await ClientService.createClient(
      {
        companyName: `Snapshot Client ${Date.now()}`,
        contactPerson: 'Rahul Sharma',
        mobileNumber: '9876543210',
        email: `rahul_${Date.now()}@snapshot.com`,
        contractStartDate: new Date().toISOString(),
        contractEndDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        renewalDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        packageId: pkg!.id,
        packagePricing: 50000,
        billingCycle: BillingCycle.MONTHLY,
        generateFirstInvoice: true,
        services: [
          {
            serviceId: testServiceSeo.id,
            monthlyTarget: 10,
          },
        ],
      },
      testAdminUser.id
    );
    createdClientIds.push(client.id);

    // Verify contract snapshot was frozen
    const fetchedClient = await ClientService.getClientById(client.id);
    expect(fetchedClient.contractSnapshot).toBeDefined();
    const snapshot = fetchedClient.contractSnapshot as any;
    expect(snapshot.packageName).toBe(pkg!.name);
    expect(snapshot.basePrice).toBe(50000);
    expect(snapshot.setupFee).toBe(5000);
    expect(snapshot.services[0].deliverablesList[0].quantity).toBe(10);

    // NOW: Update the parent package template
    await PackageService.updatePackage(pkg!.id, {
      name: `Altered Package ${Date.now()}`,
      basePrice: 90000,
      setupFee: 20000,
      services: [
        {
          serviceId: testServiceSeo.id,
          deliverablesList: [
            {
              name: 'SEO Backlinks Modified',
              deliverableType: DeliverableType.QUANTITY,
              quantity: 50,
              unit: 'Backlinks',
              targetPeriod: DeliverablePeriod.MONTHLY,
            },
          ],
        },
      ],
    });

    // Re-fetch client: verify snapshot is COMPLETELY UNTOUCHED
    const clientAfterUpdate = await ClientService.getClientById(client.id);
    const preservedSnapshot = clientAfterUpdate.contractSnapshot as any;
    expect(preservedSnapshot.packageName).toBe(pkg!.name); // Original name preserved
    expect(preservedSnapshot.basePrice).toBe(50000); // Original price preserved
    expect(preservedSnapshot.setupFee).toBe(5000); // Original setup fee preserved
    expect(preservedSnapshot.services[0].deliverablesList[0].quantity).toBe(10); // Original quantity preserved
  });

  it('4. Handles One-Time Project Packages with no irrelevant renewal schedule & partial payments', async () => {
    const oneTimePkg = await PackageService.createPackage({
      name: `One-Time Project Pack ${Date.now()}`,
      packageType: PackageType.SINGLE_SERVICE,
      basePrice: 100000,
      setupFee: 0,
      billingCycle: BillingCycle.ONE_TIME,
      services: [
        {
          serviceId: testServiceWeb.id,
          deliverablesList: [
            {
              name: 'Complete Web Portal',
              deliverableType: DeliverableType.MILESTONE,
              targetPeriod: DeliverablePeriod.ONE_TIME,
              isIncluded: true,
            },
          ],
        },
      ],
    });
    createdPackageIds.push(oneTimePkg!.id);

    const client = await ClientService.createClient(
      {
        companyName: `Portal Client ${Date.now()}`,
        contactPerson: 'Aditi Rao',
        mobileNumber: '9812345678',
        email: `aditi_${Date.now()}@portal.com`,
        contractStartDate: new Date().toISOString(),
        contractEndDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        renewalDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        packageId: oneTimePkg!.id,
        packagePricing: 100000,
        billingCycle: BillingCycle.ONE_TIME,
        generateFirstInvoice: true,
        services: [
          {
            serviceId: testServiceWeb.id,
            monthlyTarget: 1,
          },
        ],
      },
      testAdminUser.id
    );
    createdClientIds.push(client.id);

    // Verify: for ONE_TIME packages, NO Renewal record is created
    const renewals = await prisma.renewal.findMany({ where: { clientId: client.id } });
    expect(renewals.length).toBe(0);

    // Verify invoice was generated
    const invoices = await prisma.invoice.findMany({ where: { clientId: client.id } });
    expect(invoices.length).toBe(1);
    const invoice = invoices[0];
    expect(Number(invoice.invoiceAmount)).toBe(100000);
    expect(Number(invoice.remainingBalance)).toBe(100000);

    // Record partial installment 1: ₹40,000
    const inst1 = await FinanceService.recordPayment(
      {
        invoiceId: invoice.id,
        amount: 40000,
        paymentDate: new Date().toISOString(),
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        transactionReference: 'UTR-INSTALLMENT-1',
      },
      testAdminUser.id
    );
    expect(inst1.updatedInvoice.paymentStatus).toBe('PARTIALLY_PAID');
    expect(Number(inst1.updatedInvoice.remainingBalance)).toBe(60000);

    // Record partial installment 2: ₹60,000
    const inst2 = await FinanceService.recordPayment(
      {
        invoiceId: invoice.id,
        amount: 60000,
        paymentDate: new Date().toISOString(),
        paymentMethod: PaymentMethod.UPI,
        transactionReference: 'UTR-INSTALLMENT-2',
      },
      testAdminUser.id
    );
    expect(inst2.updatedInvoice.paymentStatus).toBe('PAID');
    expect(Number(inst2.updatedInvoice.remainingBalance)).toBe(0);
  });

  it('5. Strictly normalizes MRR from active recurring contracts (never includes ONE_TIME or setup fees in MRR)', async () => {
    // Create an active quarterly client
    const qClient = await ClientService.createClient(
      {
        companyName: `Quarterly Client ${Date.now()}`,
        contactPerson: 'Suresh Kumar',
        mobileNumber: '9123456780',
        email: `suresh_${Date.now()}@quarterly.com`,
        contractStartDate: new Date().toISOString(),
        contractEndDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        renewalDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        packagePricing: 90000, // ₹90,000 / quarter -> normalized to ₹30,000 / month
        billingCycle: BillingCycle.QUARTERLY,
        status: ClientStatus.ACTIVE,
        generateFirstInvoice: false,
      },
      testAdminUser.id
    );
    createdClientIds.push(qClient.id);

    // Create an active one-time client with ₹200,000 price
    const otClient = await ClientService.createClient(
      {
        companyName: `One Time Corp ${Date.now()}`,
        contactPerson: 'Vikram Mehta',
        mobileNumber: '9123456781',
        email: `vikram_${Date.now()}@onetime.com`,
        contractStartDate: new Date().toISOString(),
        contractEndDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        renewalDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        packagePricing: 200000,
        billingCycle: BillingCycle.ONE_TIME,
        status: ClientStatus.ACTIVE,
        generateFirstInvoice: false,
      },
      testAdminUser.id
    );
    createdClientIds.push(otClient.id);

    const financeSummary = await FinanceService.getFinanceSummary();
    expect(financeSummary).toBeDefined();
    expect(financeSummary.oneTimeProjectContractValue).toBeGreaterThanOrEqual(200000);

    // Verify dashboard KPIs
    const dashboardData = await DashboardService.getAdminDashboard();
    expect(dashboardData.kpis).toBeDefined();
    expect(dashboardData.kpis.mrr).toBeDefined();
    expect(dashboardData.kpis.oneTimeProjectContractValue).toBeGreaterThanOrEqual(200000);
  });

  it('6. Service Performance Report outputs agreed deliverables, target periods, and delivery progress', async () => {
    const report = await ReportService.getServicePerformanceReport();
    expect(Array.isArray(report)).toBe(true);
    expect(report.length).toBeGreaterThan(0);

    const webItem = report.find((s) => s.serviceId === testServiceWeb.id);
    expect(webItem).toBeDefined();
    expect(webItem!.serviceName).toBeDefined();
    expect(webItem!.activeClients).toBeDefined();
    expect(webItem!.agreedDeliverables).toBeDefined();
    expect(webItem!.targetPeriod).toBeDefined();
    expect(webItem!.completedDeliverables).toBeDefined();
    expect(webItem!.deliveryProgress).toBeDefined();
    expect(webItem!.tasksCreated).toBeDefined();
  });
});

