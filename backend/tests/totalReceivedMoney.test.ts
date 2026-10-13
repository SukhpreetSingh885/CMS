import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db.js';
import { FinanceService } from '../src/services/finance.service.js';
import { DashboardService } from '../src/services/dashboard.service.js';
import { ReportService } from '../src/services/report.service.js';
import { PaymentStatus, PaymentMethod, Role, UserStatus } from '@prisma/client';

describe('VIRALSTAN CMS — TOTAL RECEIVED MONEY TESTS', () => {
  let testAdmin: any;
  let clientA: any;
  let clientB: any;
  let invoiceA: any;
  let invoiceB: any;
  let paymentA: any;
  let paymentB: any;
  let createdClientIds: string[] = [];

  beforeAll(async () => {
    testAdmin = await prisma.user.findFirst({
      where: { role: Role.ADMIN, status: UserStatus.ACTIVE },
    });
    if (!testAdmin) {
      testAdmin = await prisma.user.create({
        data: {
          email: `received_money_admin_${Date.now()}@viralstan.com`,
          password: 'AdminPassword@2026',
          fullName: 'Total Received Money Admin',
          role: Role.ADMIN,
          status: UserStatus.ACTIVE,
        },
      });
    }

    const now = new Date();
    // Create Client A (Contract value 50,000)
    clientA = await prisma.client.create({
      data: {
        companyName: `Client A Received Money Test ${Date.now()}`,
        contactPerson: 'Client A Manager',
        mobileNumber: '9876543211',
        email: `client_a_${Date.now()}@test.com`,
        contractStartDate: now,
        contractEndDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        renewalDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        packagePricing: 50000,
        billingCycle: 'ONE_TIME',
      },
    });
    createdClientIds.push(clientA.id);

    // Create Client B (Contract value 49,970)
    clientB = await prisma.client.create({
      data: {
        companyName: `Client B Received Money Test ${Date.now()}`,
        contactPerson: 'Client B Manager',
        mobileNumber: '9876543212',
        email: `client_b_${Date.now()}@test.com`,
        contractStartDate: now,
        contractEndDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        renewalDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        packagePricing: 49970,
        billingCycle: 'MONTHLY',
      },
    });
    createdClientIds.push(clientB.id);

    // Create Invoice for Client A: 50,000
    invoiceA = await prisma.invoice.create({
      data: {
        clientId: clientA.id,
        invoiceNumber: `INV-TEST-A-${Date.now().toString().slice(-4)}`,
        invoiceDate: now,
        dueDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
        packageValue: 50000,
        invoiceAmount: 50000,
        amountPaid: 0,
        remainingBalance: 50000,
        paymentStatus: PaymentStatus.NOT_DUE,
      },
    });

    // Create Invoice for Client B: 49,970
    invoiceB = await prisma.invoice.create({
      data: {
        clientId: clientB.id,
        invoiceNumber: `INV-TEST-B-${Date.now().toString().slice(-4)}`,
        invoiceDate: now,
        dueDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
        packageValue: 49970,
        invoiceAmount: 49970,
        amountPaid: 0,
        remainingBalance: 49970,
        paymentStatus: PaymentStatus.NOT_DUE,
      },
    });
  });

  afterAll(async () => {
    for (const clientId of createdClientIds) {
      await prisma.payment.deleteMany({ where: { clientId } });
      await prisma.invoice.deleteMany({ where: { clientId } });
      await prisma.client.deleteMany({ where: { id: clientId } });
    }
  });

  it('1. Before any payments, unpaid invoices and contract values are NOT counted as received money', async () => {
    const summaryBefore = await FinanceService.calculateReceivedMoney();
    // Query payments specifically for our test clients
    const clientPayments = await prisma.payment.findMany({
      where: { clientId: { in: [clientA.id, clientB.id] }, isVoided: false },
    });
    expect(clientPayments.length).toBe(0);

    const clientAPaid = await prisma.payment.aggregate({
      where: { clientId: clientA.id, isVoided: false },
      _sum: { amount: true },
    });
    expect(Number(clientAPaid._sum.amount || 0)).toBe(0);
  });

  it('2. Records partial payment (₹25,000 for Client A) and full payment (₹49,970 for Client B)', async () => {
    // Record partial installment of 25,000 on Invoice A (total 50,000, remaining 25,000)
    const resA = await FinanceService.recordPayment(
      {
        invoiceId: invoiceA.id,
        amount: 25000,
        paymentDate: new Date().toISOString(),
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        transactionReference: `TXN-A-${Date.now()}`,
      },
      testAdmin.id
    );
    paymentA = resA.payment;
    expect(Number(resA.updatedInvoice.amountPaid)).toBe(25000);
    expect(Number(resA.updatedInvoice.remainingBalance)).toBe(25000);
    expect(resA.updatedInvoice.paymentStatus).toBe(PaymentStatus.PARTIALLY_PAID);

    // Record full payment of 49,970 on Invoice B (total 49,970, remaining 0)
    const resB = await FinanceService.recordPayment(
      {
        invoiceId: invoiceB.id,
        amount: 49970,
        paymentDate: new Date().toISOString(),
        paymentMethod: PaymentMethod.UPI,
        transactionReference: `TXN-B-${Date.now()}`,
      },
      testAdmin.id
    );
    paymentB = resB.payment;
    expect(Number(resB.updatedInvoice.amountPaid)).toBe(49970);
    expect(Number(resB.updatedInvoice.remainingBalance)).toBe(0);
    expect(resB.updatedInvoice.paymentStatus).toBe(PaymentStatus.PAID);

    // Verify sum of received money for these clients is exactly 25,000 + 49,970 = 74,970 (NOT 99,970)
    const testPayments = await prisma.payment.findMany({
      where: { clientId: { in: [clientA.id, clientB.id] }, isVoided: false },
    });
    const sumForTest = testPayments.reduce((acc, p) => acc + Number(p.amount), 0);
    expect(sumForTest).toBe(74970);
  });

  it('3. FinanceService.calculateReceivedMoney reflects exact received sum and breakdown', async () => {
    const received = await FinanceService.calculateReceivedMoney();
    expect(received.totalReceivedMoney).toBeGreaterThanOrEqual(74970);
    expect(received.allTimeReceivedMoney).toBeGreaterThanOrEqual(74970);
    expect(received.paymentCount).toBeGreaterThanOrEqual(2);

    // Breakdown includes both one-time and recurring
    expect(received.breakdown.oneTimeProjectsReceived).toBeGreaterThanOrEqual(25000);
    expect(received.breakdown.recurringServicesReceived).toBeGreaterThanOrEqual(49970);
  });

  it('4. Admin Dashboard KPIs return totalReceivedMoney and synchronize with Finance summary', async () => {
    const dash = await DashboardService.getAdminDashboard();
    expect(dash.kpis.totalReceivedMoney).toBeDefined();
    expect(typeof dash.kpis.totalReceivedMoney).toBe('number');
    expect(dash.kpis.totalReceivedMoney).toBeGreaterThanOrEqual(74970);
    expect(dash.kpis.allTimeReceivedMoney).toBeGreaterThanOrEqual(74970);

    const financeSummary = await FinanceService.getFinanceSummary();
    expect(financeSummary.totalReceivedMoney).toBe(dash.kpis.totalReceivedMoney);
    expect(financeSummary.totalCollected).toBe(dash.kpis.totalReceivedMoney);

    const revenueReport = await ReportService.getRevenueAndPaymentReport();
    expect(revenueReport.summary.totalReceivedMoney).toBe(dash.kpis.totalReceivedMoney);
    expect(revenueReport.summary.totalCollected).toBe(dash.kpis.totalReceivedMoney);
  });

  it('5. Voiding a payment immediately deducts it from Total Received Money', async () => {
    const beforeVoid = await FinanceService.calculateReceivedMoney();

    // Void payment A (₹25,000)
    await FinanceService.voidPayment(paymentA.id, 'Test reversal of partial payment', testAdmin.id);

    const afterVoid = await FinanceService.calculateReceivedMoney();
    expect(afterVoid.totalReceivedMoney).toBe(beforeVoid.totalReceivedMoney - 25000);

    // Invoice A balance is restored to 50,000 unpaid
    const refreshedInvoiceA = await prisma.invoice.findUnique({ where: { id: invoiceA.id } });
    expect(Number(refreshedInvoiceA?.amountPaid)).toBe(0);
    expect(Number(refreshedInvoiceA?.remainingBalance)).toBe(50000);
  });

  it('6. Date filtering by paymentDate isolates transactions in the specified period', async () => {
    // Both paymentA and paymentB were created today
    const todayResult = await FinanceService.calculateReceivedMoney({ dateRange: 'today' });
    expect(todayResult.totalReceivedMoney).toBeGreaterThanOrEqual(49970);

    // Yesterday filter should not include today's payment
    const yesterdayResult = await FinanceService.calculateReceivedMoney({ dateRange: 'yesterday' });
    // Yesterday result must not include paymentB (which happened today)
    const testPaymentsYesterday = await prisma.payment.findMany({
      where: {
        id: paymentB.id,
        isVoided: false,
        paymentDate: {
          gte: new Date(Date.now() - 48 * 3600000),
          lt: new Date(Date.now() - 24 * 3600000),
        },
      },
    });
    expect(testPaymentsYesterday.length).toBe(0);
  });
});

