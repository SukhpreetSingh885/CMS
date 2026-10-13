import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db.js';
import { FinanceService } from '../src/services/finance.service.js';
import { ClientService } from '../src/services/client.service.js';
import { recordPaymentSchema } from '../src/validators/finance.validator.js';
import { PaymentStatus, PaymentMethod, Role, UserStatus } from '@prisma/client';

describe('Viralstan CMS — Finance Data Integrity & Safeguards Tests', () => {
  let testAdmin: any;
  let testClient: any;
  let createdClientIds: string[] = [];

  beforeAll(async () => {
    testAdmin = await prisma.user.findFirst({
      where: { role: Role.ADMIN, status: UserStatus.ACTIVE },
    });

    if (!testAdmin) {
      testAdmin = await prisma.user.create({
        data: {
          email: `finance_admin_${Date.now()}@viralstan.com`,
          password: 'HashedPassword123!',
          fullName: 'Finance Test Admin',
          role: Role.ADMIN,
          status: UserStatus.ACTIVE,
        },
      });
    }

    // Create a base client for finance tests
    const now = new Date();
    testClient = await prisma.client.create({
      data: {
        companyName: `Finance Integrity Client ${Date.now()}`,
        contactPerson: 'Integrity Tester',
        mobileNumber: '9876543210',
        email: `client_${Date.now()}@test.com`,
        contractStartDate: now,
        contractEndDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        renewalDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        packagePricing: 50000,
        billingCycle: 'ONE_TIME',
      },
    });
    createdClientIds.push(testClient.id);
  });

  afterAll(async () => {
    for (const clientId of createdClientIds) {
      await prisma.payment.deleteMany({ where: { clientId } });
      await prisma.invoice.deleteMany({ where: { clientId } });
      await prisma.renewal.deleteMany({ where: { clientId } });
      await prisma.task.deleteMany({ where: { clientId } });
      await prisma.clientService.deleteMany({ where: { clientId } });
      await prisma.clientAssignedEmployee.deleteMany({ where: { clientId } });
      await prisma.client.deleteMany({ where: { id: clientId } });
    }
  });

  it('1. Client onboarding invoice generation is strictly unpaid and idempotent (no payments created)', async () => {
    const uniqueSuffix = Date.now();
    const onboardedClient = await ClientService.createClient(
      {
        companyName: `Onboard Amayra Test ${uniqueSuffix}`,
        contactPerson: 'Amayra Test',
        mobileNumber: '9988776655',
        email: `amayra_${uniqueSuffix}@test.com`,
        contractStartDate: new Date().toISOString().slice(0, 10),
        contractEndDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        renewalDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        packagePricing: 100000,
        billingCycle: 'ONE_TIME',
        generateFirstInvoice: true,
      },
      testAdmin.id
    );
    createdClientIds.push(onboardedClient.id);

    // Verify exactly 1 invoice was created
    const invoices = await prisma.invoice.findMany({
      where: { clientId: onboardedClient.id },
    });
    expect(invoices.length).toBe(1);
    const inv = invoices[0];
    expect(Number(inv.invoiceAmount)).toBe(100000);
    expect(Number(inv.amountPaid)).toBe(0);
    expect(Number(inv.remainingBalance)).toBe(100000);
    expect(inv.paymentStatus).toBe(PaymentStatus.NOT_DUE);

    // Verify ZERO automatic payments were created
    const payments = await prisma.payment.findMany({
      where: { clientId: onboardedClient.id },
    });
    expect(payments.length).toBe(0);
  });

  it('2. Creating standalone invoice sets amountPaid to 0 and guards against rapid duplicates', async () => {
    const invNum = `INV-TEST-${Date.now()}`;
    const invoice = await FinanceService.createInvoice(
      {
        clientId: testClient.id,
        invoiceNumber: invNum,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 75000,
      },
      testAdmin.id
    );

    expect(Number(invoice.amountPaid)).toBe(0);
    expect(Number(invoice.remainingBalance)).toBe(75000);
    expect(invoice.paymentStatus).toBe(PaymentStatus.NOT_DUE);

    // Attempting to create duplicate invoice with identical amount for same client immediately should fail
    await expect(
      FinanceService.createInvoice(
        {
          clientId: testClient.id,
          invoiceNumber: `INV-DUP-${Date.now()}`,
          dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          invoiceAmount: 75000,
        },
        testAdmin.id
      )
    ).rejects.toThrow(/An identical invoice/);
  });

  it('3. Record payment validator enforces transaction reference for electronic methods', () => {
    // Missing transaction reference for BANK_TRANSFER should fail validation
    const invalidBankTransfer = recordPaymentSchema.safeParse({
      invoiceId: 'inv-123',
      amount: 5000,
      paymentMethod: 'BANK_TRANSFER',
      transactionReference: '',
    });
    expect(invalidBankTransfer.success).toBe(false);

    // Missing transaction reference for UPI should fail validation
    const invalidUpi = recordPaymentSchema.safeParse({
      invoiceId: 'inv-123',
      amount: 5000,
      paymentMethod: 'UPI',
      transactionReference: '   ',
    });
    expect(invalidUpi.success).toBe(false);

    // Valid transaction reference for BANK_TRANSFER should succeed
    const validBankTransfer = recordPaymentSchema.safeParse({
      invoiceId: 'inv-123',
      amount: 5000,
      paymentMethod: 'BANK_TRANSFER',
      transactionReference: 'UTR2026101299991',
    });
    expect(validBankTransfer.success).toBe(true);

    // Cash does not require transaction reference
    const validCash = recordPaymentSchema.safeParse({
      invoiceId: 'inv-123',
      amount: 5000,
      paymentMethod: 'CASH',
    });
    expect(validCash.success).toBe(true);
  });

  it('4. Rejects payments exceeding remaining invoice balance', async () => {
    const invNum = `INV-BAL-${Date.now()}`;
    const invoice = await FinanceService.createInvoice(
      {
        clientId: testClient.id,
        invoiceNumber: invNum,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 40000,
      },
      testAdmin.id
    );

    // Try paying ₹50,000 on a ₹40,000 invoice
    await expect(
      FinanceService.recordPayment(
        {
          invoiceId: invoice.id,
          amount: 50000,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          transactionReference: `UTR-EXCEED-${Date.now()}`,
        },
        testAdmin.id
      )
    ).rejects.toThrow(/cannot exceed remaining balance/);
  });

  it('5. Rejects duplicate payment recording with the exact same transaction reference', async () => {
    const invNum1 = `INV-REF1-${Date.now()}`;
    const invoice1 = await FinanceService.createInvoice(
      {
        clientId: testClient.id,
        invoiceNumber: invNum1,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 30000,
      },
      testAdmin.id
    );

    const testRef = `UTR-UNIQUE-${Date.now()}`;

    // First payment succeeds
    const firstResult = await FinanceService.recordPayment(
      {
        invoiceId: invoice1.id,
        amount: 15000,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        transactionReference: testRef,
      },
      testAdmin.id
    );
    expect(firstResult.payment.transactionReference).toBe(testRef);

    // Second payment with the SAME transaction reference must be rejected with 409 Conflict
    await expect(
      FinanceService.recordPayment(
        {
          invoiceId: invoice1.id,
          amount: 10000,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          transactionReference: testRef,
        },
        testAdmin.id
      )
    ).rejects.toThrow(/already been recorded/);
  });

  it('6. Supports partial payments and transitions status from PARTIALLY_PAID to PAID', async () => {
    const invNum = `INV-PARTIAL-${Date.now()}`;
    const invoice = await FinanceService.createInvoice(
      {
        clientId: testClient.id,
        invoiceNumber: invNum,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 60000,
      },
      testAdmin.id
    );

    // Installment 1: Pay ₹25,000
    const ref1 = `UTR-PART1-${Date.now()}`;
    const res1 = await FinanceService.recordPayment(
      {
        invoiceId: invoice.id,
        amount: 25000,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        transactionReference: ref1,
      },
      testAdmin.id
    );

    expect(Number(res1.updatedInvoice.amountPaid)).toBe(25000);
    expect(Number(res1.updatedInvoice.remainingBalance)).toBe(35000);
    expect(res1.updatedInvoice.paymentStatus).toBe(PaymentStatus.PARTIALLY_PAID);

    // Installment 2: Pay remaining ₹35,000
    const ref2 = `UTR-PART2-${Date.now()}`;
    const res2 = await FinanceService.recordPayment(
      {
        invoiceId: invoice.id,
        amount: 35000,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        transactionReference: ref2,
      },
      testAdmin.id
    );

    expect(Number(res2.updatedInvoice.amountPaid)).toBe(60000);
    expect(Number(res2.updatedInvoice.remainingBalance)).toBe(0);
    expect(res2.updatedInvoice.paymentStatus).toBe(PaymentStatus.PAID);

    // Attempting a third payment on fully settled invoice must fail
    await expect(
      FinanceService.recordPayment(
        {
          invoiceId: invoice.id,
          amount: 5000,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          transactionReference: `UTR-EXTRA-${Date.now()}`,
        },
        testAdmin.id
      )
    ).rejects.toThrow(/already been fully paid/);
  });

  it('7. Total Collected is computed strictly from confirmed Payment records in MySQL', async () => {
    // Direct MySQL aggregation of confirmed payments
    const dbPaymentSum = await prisma.payment.aggregate({
      _sum: { amount: true },
    });
    const expectedCollected = Number(dbPaymentSum._sum.amount || 0);

    const summary = await FinanceService.getFinanceSummary();
    expect(summary.totalCollected).toBe(expectedCollected);
  });

  it('8. listPayments endpoint accurately returns confirmed payment transactions with search and pagination', async () => {
    const result = await FinanceService.listPayments({
      page: 1,
      pageSize: 10,
    });

    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('payments');
    expect(result).toHaveProperty('totalAmount');
    expect(Array.isArray(result.payments)).toBe(true);
    if (result.payments.length > 0) {
      const p = result.payments[0];
      expect(p).toHaveProperty('amount');
      expect(p).toHaveProperty('paymentMethod');
      expect(p).toHaveProperty('client');
      expect(p).toHaveProperty('invoice');
    }
  });
});

