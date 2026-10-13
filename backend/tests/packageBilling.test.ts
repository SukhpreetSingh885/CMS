import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db.js';
import { createPackageSchema } from '../src/validators/package.validator.js';
import { createClientSchema } from '../src/validators/client.validator.js';
import { ClientService } from '../src/services/client.service.js';
import { FinanceService } from '../src/services/finance.service.js';
import { DashboardService } from '../src/services/dashboard.service.js';
import { PaymentStatus, Role, UserStatus } from '@prisma/client';

describe('Viralstan CMS — One-Time & Recurring Package Billing System Tests', () => {
  let testAdminUser: any;
  let testService: any;
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
          email: 'test_admin_billing@viralstan.com',
          password: 'HashedPassword123!',
          fullName: 'Test Billing Admin',
          role: Role.ADMIN,
          status: UserStatus.ACTIVE,
        },
      });
    }

    // 2. Ensure a dedicated test service exists for this suite
    testService = await prisma.service.create({
      data: {
        name: `Billing Test Service ${Date.now()}`,
        description: 'Test service description',
        defaultMonthlyTarget: 12,
      },
    });
  });

  afterAll(async () => {
    // Cleanup created test records
    for (const clientId of createdClientIds) {
      await prisma.payment.deleteMany({ where: { clientId } });
      await prisma.invoice.deleteMany({ where: { clientId } });
      await prisma.renewal.deleteMany({ where: { clientId } });
      await prisma.task.deleteMany({ where: { clientId } });
      await prisma.clientService.deleteMany({ where: { clientId } });
      await prisma.clientAssignedEmployee.deleteMany({ where: { clientId } });
      await prisma.client.deleteMany({ where: { id: clientId } });
    }

    for (const pkgId of createdPackageIds) {
      await prisma.packageService.deleteMany({ where: { packageId: pkgId } });
      await prisma.package.deleteMany({ where: { id: pkgId } });
    }

    if (testService?.id) {
      await prisma.clientService.deleteMany({ where: { serviceId: testService.id } }).catch(() => {});
      await prisma.packageService.deleteMany({ where: { serviceId: testService.id } }).catch(() => {});
      await prisma.service.delete({ where: { id: testService.id } }).catch(() => {});
    }
  });

  describe('1. Zod Validation for Package & Client Billing Types', () => {
    it('validates ONE_TIME billing cycle for a project package schema', () => {
      const validOneTime = {
        name: 'Website Redesign Project',
        description: 'Fixed scope total deliverable bundle',
        basePrice: 75000,
        billingCycle: 'ONE_TIME',
        services: [
          {
            serviceId: testService.id,
            monthlyTarget: 1, // represents total project target
            defaultWeight: 1.0,
          },
        ],
      };

      const parsed = createPackageSchema.safeParse(validOneTime);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.billingCycle).toBe('ONE_TIME');
        expect(parsed.data.basePrice).toBe(75000);
      }
    });

    it('validates recurring billing options: MONTHLY, QUARTERLY, and YEARLY', () => {
      const recurringCycles = ['MONTHLY', 'QUARTERLY', 'YEARLY', 'ANNUALLY'];
      for (const cycle of recurringCycles) {
        const parsed = createPackageSchema.safeParse({
          name: `Retainer Package ${cycle}`,
          basePrice: 45000,
          billingCycle: cycle,
        });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.billingCycle).toBe(cycle);
        }
      }
    });

    it('rejects invalid billing cycle and negative prices', () => {
      const invalidCycle = createPackageSchema.safeParse({
        name: 'Invalid Cycle Pkg',
        basePrice: 50000,
        billingCycle: 'BI_WEEKLY' as any,
      });
      expect(invalidCycle.success).toBe(false);

      const negativePrice = createPackageSchema.safeParse({
        name: 'Negative Price Pkg',
        basePrice: -5000,
        billingCycle: 'ONE_TIME',
      });
      expect(negativePrice.success).toBe(false);
    });

    it('validates client onboarding schema with ONE_TIME project billing', () => {
      const parsed = createClientSchema.safeParse({
        companyName: 'Acme One-Time Corp',
        contactPerson: 'John Smith',
        mobileNumber: '9876543210',
        email: 'john@acme-onetime.com',
        contractStartDate: '2026-11-01',
        contractEndDate: '2026-12-15',
        renewalDate: '2026-12-15',
        packagePricing: 80000,
        billingCycle: 'ONE_TIME',
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.billingCycle).toBe('ONE_TIME');
        expect(parsed.data.packagePricing).toBe(80000);
      }
    });
  });

  describe('2. MySQL Database Package Creation with Real Records', () => {
    it('creates a ONE_TIME package record in MySQL with deliverable targets', async () => {
      const pkg = await prisma.package.create({
        data: {
          name: `One-Time Project Pack ${Date.now()}`,
          description: 'One-time fixed price project deliverable package',
          basePrice: 120000,
          billingCycle: 'ONE_TIME',
          packageServices: {
            create: [
              {
                serviceId: testService.id,
                monthlyTarget: 15, // Total project target
                defaultWeight: 1.0,
              },
            ],
          },
        },
        include: {
          packageServices: { include: { service: true } },
        },
      });

      createdPackageIds.push(pkg.id);

      expect(pkg.id).toBeDefined();
      expect(pkg.billingCycle).toBe('ONE_TIME');
      expect(Number(pkg.basePrice)).toBe(120000);
      expect(pkg.packageServices.length).toBe(1);
      expect(pkg.packageServices[0].monthlyTarget).toBe(15);
    });

    it('creates a recurring YEARLY package record in MySQL', async () => {
      const pkg = await prisma.package.create({
        data: {
          name: `Annual Retainer Pack ${Date.now()}`,
          description: 'Yearly recurring retainer',
          basePrice: 500000,
          billingCycle: 'YEARLY',
        },
      });

      createdPackageIds.push(pkg.id);

      expect(pkg.id).toBeDefined();
      expect(pkg.billingCycle).toBe('YEARLY');
      expect(Number(pkg.basePrice)).toBe(500000);
    });
  });

  describe('3. Client Onboarding: One-Time vs Recurring Contract & Renewal Rules', () => {
    it('One-Time Client: creates project invoice WITHOUT creating recurring renewal schedule', async () => {
      const clientEmail = `client_onetime_${Date.now()}@viralstan-test.com`;

      const client = await ClientService.createClient(
        {
          companyName: 'One-Time Project Client',
          contactPerson: 'David Miller',
          mobileNumber: '+91 9911223344',
          email: clientEmail,
          contractStartDate: '2026-11-01',
          contractEndDate: '2026-12-31',
          renewalDate: '2026-12-31',
          packagePricing: 95000,
          billingCycle: 'ONE_TIME',
          generateFirstInvoice: true,
          services: [
            {
              serviceId: testService.id,
              monthlyTarget: 10,
              serviceWeight: 1.0,
            },
          ],
        },
        testAdminUser.id
      );

      createdClientIds.push(client.id);

      expect(client.id).toBeDefined();
      expect(client.billingCycle).toBe('ONE_TIME');
      expect(Number(client.packagePricing)).toBe(95000);

      // Verify that NO renewal record was created for one-time package
      const renewalCount = await prisma.renewal.count({ where: { clientId: client.id } });
      expect(renewalCount).toBe(0);

      // Verify that the project invoice was created
      const invoices = await prisma.invoice.findMany({ where: { clientId: client.id } });
      expect(invoices.length).toBe(1);
      const projectInvoice = invoices[0];
      expect(Number(projectInvoice.invoiceAmount)).toBe(95000);
      expect(Number(projectInvoice.remainingBalance)).toBe(95000);
      expect(Number(projectInvoice.amountPaid)).toBe(0);
      expect(projectInvoice.paymentStatus).toBe(PaymentStatus.NOT_DUE);
      expect(projectInvoice.notes).toContain('One-time project contract invoice');
    });

    it('Recurring Client: creates first invoice AND creates renewal tracking schedule', async () => {
      const clientEmail = `client_recurring_${Date.now()}@viralstan-test.com`;

      const client = await ClientService.createClient(
        {
          companyName: 'Recurring Retainer Client',
          contactPerson: 'Sarah Jenkins',
          mobileNumber: '+91 9988776655',
          email: clientEmail,
          contractStartDate: '2026-11-01',
          contractEndDate: '2027-10-31',
          renewalDate: '2027-10-31',
          packagePricing: 40000,
          billingCycle: 'MONTHLY',
          generateFirstInvoice: true,
        },
        testAdminUser.id
      );

      createdClientIds.push(client.id);

      expect(client.id).toBeDefined();
      expect(client.billingCycle).toBe('MONTHLY');

      // Verify renewal tracking WAS created for recurring client
      const renewal = await prisma.renewal.findFirst({ where: { clientId: client.id } });
      expect(renewal).not.toBeNull();
      expect(Number(renewal?.renewalAmount)).toBe(40000);

      // Verify invoice was created
      const invoices = await prisma.invoice.findMany({ where: { clientId: client.id } });
      expect(invoices.length).toBe(1);
      expect(Number(invoices[0].invoiceAmount)).toBe(40000);
      expect(invoices[0].notes).toContain('First onboarding invoice');
    });
  });

  describe('4. Milestone-Based and Partial Payments against One-Time Project Invoices', () => {
    it('records partial milestone payment without altering agreed project price', async () => {
      const clientEmail = `client_milestone_${Date.now()}@viralstan-test.com`;
      const client = await ClientService.createClient(
        {
          companyName: 'Milestone Brand Labs',
          contactPerson: 'Alex Rivera',
          mobileNumber: '+91 9123456789',
          email: clientEmail,
          contractStartDate: '2026-11-01',
          contractEndDate: '2027-01-31',
          renewalDate: '2027-01-31',
          packagePricing: 100000, // Total project price: ₹1,00,000
          billingCycle: 'ONE_TIME',
          generateFirstInvoice: true,
        },
        testAdminUser.id
      );

      createdClientIds.push(client.id);

      const invoice = await prisma.invoice.findFirstOrThrow({ where: { clientId: client.id } });
      expect(Number(invoice.invoiceAmount)).toBe(100000);
      expect(Number(invoice.remainingBalance)).toBe(100000);

      // Milestone 1: Record 40% advance payment (₹40,000)
      const milestone1 = await FinanceService.recordPayment(
        {
          invoiceId: invoice.id,
          amount: 40000,
          transactionReference: 'TXN_MILESTONE_1',
          notes: 'Milestone 1 (40% project kickoff advance)',
        },
        testAdminUser.id
      );

      // Agreed project price must NOT change
      expect(Number(milestone1.updatedInvoice.invoiceAmount)).toBe(100000);
      // Balance decrements atomically
      expect(Number(milestone1.updatedInvoice.amountPaid)).toBe(40000);
      expect(Number(milestone1.updatedInvoice.remainingBalance)).toBe(60000);
      // Payment status reflects PARTIALLY_PAID
      expect(milestone1.updatedInvoice.paymentStatus).toBe(PaymentStatus.PARTIALLY_PAID);

      // Milestone 2: Record remaining 60% payment (₹60,000)
      const milestone2 = await FinanceService.recordPayment(
        {
          invoiceId: invoice.id,
          amount: 60000,
          transactionReference: 'TXN_MILESTONE_2',
          notes: 'Milestone 2 (Final deliverable sign-off)',
        },
        testAdminUser.id
      );

      // Agreed project price still intact at ₹1,00,000
      expect(Number(milestone2.updatedInvoice.invoiceAmount)).toBe(100000);
      expect(Number(milestone2.updatedInvoice.amountPaid)).toBe(100000);
      expect(Number(milestone2.updatedInvoice.remainingBalance)).toBe(0);
      expect(milestone2.updatedInvoice.paymentStatus).toBe(PaymentStatus.PAID);
    });
  });

  describe('5. Revenue Statistics: Pure MRR vs One-Time Project Revenue Isolation', () => {
    it('isolates recurring monthly revenue (MRR) from one-time project invoices', async () => {
      const summary = await FinanceService.getFinanceSummary();
      expect(summary).toBeDefined();
      expect(typeof summary.monthlyInvoicedRevenue).toBe('number');
      expect(typeof summary.monthlyRecurringRevenue).toBe('number');
      expect(typeof summary.monthlyOneTimeRevenue).toBe('number');

      // Total monthly invoiced must equal MRR + OneTime
      expect(summary.monthlyInvoicedRevenue).toBe(
        summary.monthlyRecurringRevenue + summary.monthlyOneTimeRevenue
      );

      // Dashboard KPI service also separates MRR and one-time project revenue
      const dashboard = await DashboardService.getAdminDashboard();
      expect(dashboard.kpis.monthlyRevenue).toBe(dashboard.kpis.monthlyRecurringRevenue);
      expect(dashboard.kpis.totalMonthlyRevenue).toBe(
        dashboard.kpis.monthlyRecurringRevenue + dashboard.kpis.monthlyOneTimeRevenue
      );
    });
  });
});
