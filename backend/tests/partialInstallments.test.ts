import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db.js';
import { FinanceService } from '../src/services/finance.service.js';
import { PaymentStatus, PaymentMethod, Role, UserStatus } from '@prisma/client';

describe('Viralstan CMS — One-Time Project Partial & Installment Payments System Tests', () => {
  let testAdmin: any;
  let createdClientIds: string[] = [];

  async function createNewTestClient(pricing = 50000) {
    const now = new Date();
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const cl = await prisma.client.create({
      data: {
        companyName: `Website Client ${suffix}`,
        contactPerson: 'Project Owner',
        mobileNumber: '9123456789',
        email: `project_client_${suffix}@viralstan.com`,
        contractStartDate: now,
        contractEndDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
        renewalDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
        packagePricing: pricing,
        billingCycle: 'ONE_TIME',
      },
    });
    createdClientIds.push(cl.id);
    return cl;
  }

  beforeAll(async () => {
    testAdmin = await prisma.user.findFirst({
      where: { role: Role.ADMIN, status: UserStatus.ACTIVE },
    });

    if (!testAdmin) {
      testAdmin = await prisma.user.create({
        data: {
          email: `installment_admin_${Date.now()}@viralstan.com`,
          password: 'HashedPassword123!',
          fullName: 'Installment Admin',
          role: Role.ADMIN,
          status: UserStatus.ACTIVE,
        },
      });
    }
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

  it('1. Rejects zero and negative payment amounts', async () => {
    const client = await createNewTestClient();
    const inv = await FinanceService.createInvoice(
      {
        clientId: client.id,
        invoiceNumber: `INV-ZERO-${Date.now()}`,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 50000,
      },
      testAdmin.id
    );

    // Zero payment
    await expect(
      FinanceService.recordPayment(
        {
          invoiceId: inv.id,
          amount: 0,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          transactionReference: `UTR-ZERO-${Date.now()}`,
        },
        testAdmin.id
      )
    ).rejects.toThrow(/greater than 0/);

    // Negative payment
    await expect(
      FinanceService.recordPayment(
        {
          invoiceId: inv.id,
          amount: -5000,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          transactionReference: `UTR-NEG-${Date.now()}`,
        },
        testAdmin.id
      )
    ).rejects.toThrow(/greater than 0/);
  });

  it('2. Records 50% advance (half payment) without changing agreed project price', async () => {
    const client = await createNewTestClient();
    const inv = await FinanceService.createInvoice(
      {
        clientId: client.id,
        invoiceNumber: `INV-HALF-${Date.now()}`,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 50000,
      },
      testAdmin.id
    );

    const ref = `UTR-HALF-${Date.now()}`;
    const res = await FinanceService.recordPayment(
      {
        invoiceId: inv.id,
        amount: 25000, // 50% advance
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        transactionReference: ref,
        notes: '50% Initial Advance for Website Project',
      },
      testAdmin.id
    );

    expect(Number(res.updatedInvoice.invoiceAmount)).toBe(50000); // Unchanged agreed price
    expect(Number(res.updatedInvoice.amountPaid)).toBe(25000);
    expect(Number(res.updatedInvoice.remainingBalance)).toBe(25000);
    expect(res.updatedInvoice.paymentStatus).toBe(PaymentStatus.PARTIALLY_PAID);
    expect(res.payment.amount.toNumber()).toBe(25000);
    expect(res.payment.transactionReference).toBe(ref);
  });

  it('3. Supports multiple installments (₹25,000 + ₹10,000 + ₹15,000) leading to completion', async () => {
    const client = await createNewTestClient();
    const inv = await FinanceService.createInvoice(
      {
        clientId: client.id,
        invoiceNumber: `INV-MULTI-${Date.now()}`,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 50000,
      },
      testAdmin.id
    );

    // Installment 1: ₹25,000
    const ref1 = `UTR-M1-${Date.now()}`;
    const p1 = await FinanceService.recordPayment(
      {
        invoiceId: inv.id,
        amount: 25000,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        transactionReference: ref1,
        notes: 'Installment 1: Kickoff milestone',
      },
      testAdmin.id
    );
    expect(Number(p1.updatedInvoice.amountPaid)).toBe(25000);
    expect(Number(p1.updatedInvoice.remainingBalance)).toBe(25000);
    expect(p1.updatedInvoice.paymentStatus).toBe(PaymentStatus.PARTIALLY_PAID);

    // Installment 2: ₹10,000
    const ref2 = `UTR-M2-${Date.now()}`;
    const p2 = await FinanceService.recordPayment(
      {
        invoiceId: inv.id,
        amount: 10000,
        paymentMethod: PaymentMethod.UPI,
        transactionReference: ref2,
        notes: 'Installment 2: Design approval milestone',
      },
      testAdmin.id
    );
    expect(Number(p2.updatedInvoice.amountPaid)).toBe(35000);
    expect(Number(p2.updatedInvoice.remainingBalance)).toBe(15000);
    expect(p2.updatedInvoice.paymentStatus).toBe(PaymentStatus.PARTIALLY_PAID);

    // Installment 3: ₹15,000 (Final settlement)
    const ref3 = `UTR-M3-${Date.now()}`;
    const p3 = await FinanceService.recordPayment(
      {
        invoiceId: inv.id,
        amount: 15000,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        transactionReference: ref3,
        notes: 'Installment 3: Final deployment settlement',
      },
      testAdmin.id
    );
    expect(Number(p3.updatedInvoice.amountPaid)).toBe(50000);
    expect(Number(p3.updatedInvoice.remainingBalance)).toBe(0);
    expect(p3.updatedInvoice.paymentStatus).toBe(PaymentStatus.PAID);

    // Verify exactly 3 separate payment records exist
    const allPayments = await prisma.payment.findMany({
      where: { invoiceId: inv.id, isVoided: false },
      orderBy: { createdAt: 'asc' },
    });
    expect(allPayments.length).toBe(3);
    expect(Number(allPayments[0].amount)).toBe(25000);
    expect(Number(allPayments[1].amount)).toBe(10000);
    expect(Number(allPayments[2].amount)).toBe(15000);
  });

  it('4. Prevents overpayments beyond the outstanding invoice balance', async () => {
    const client = await createNewTestClient();
    const inv = await FinanceService.createInvoice(
      {
        clientId: client.id,
        invoiceNumber: `INV-OVERPAY-${Date.now()}`,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 30000,
      },
      testAdmin.id
    );

    // Pay ₹20,000
    await FinanceService.recordPayment(
      {
        invoiceId: inv.id,
        amount: 20000,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        transactionReference: `UTR-OP1-${Date.now()}`,
      },
      testAdmin.id
    );

    // Attempt paying ₹15,000 when only ₹10,000 remains
    await expect(
      FinanceService.recordPayment(
        {
          invoiceId: inv.id,
          amount: 15000,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          transactionReference: `UTR-OP2-${Date.now()}`,
        },
        testAdmin.id
      )
    ).rejects.toThrow(/cannot exceed remaining balance/);
  });

  it('5. Prevents duplicate transaction references across payments', async () => {
    const client1 = await createNewTestClient();
    const client2 = await createNewTestClient();

    const inv1 = await FinanceService.createInvoice(
      {
        clientId: client1.id,
        invoiceNumber: `INV-DUP1-${Date.now()}`,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 40000,
      },
      testAdmin.id
    );

    const inv2 = await FinanceService.createInvoice(
      {
        clientId: client2.id,
        invoiceNumber: `INV-DUP2-${Date.now()}`,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 40000,
      },
      testAdmin.id
    );

    const sharedRef = `UTR-UNIQUE-CHECK-${Date.now()}`;

    // First payment succeeds
    await FinanceService.recordPayment(
      {
        invoiceId: inv1.id,
        amount: 10000,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        transactionReference: sharedRef,
      },
      testAdmin.id
    );

    // Second payment with the SAME reference must be rejected
    await expect(
      FinanceService.recordPayment(
        {
          invoiceId: inv2.id,
          amount: 10000,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          transactionReference: sharedRef,
        },
        testAdmin.id
      )
    ).rejects.toThrow(/already been recorded/);
  });

  it('6. Concurrency lock prevents race conditions and concurrent overpayments', async () => {
    const client = await createNewTestClient();
    const inv = await FinanceService.createInvoice(
      {
        clientId: client.id,
        invoiceNumber: `INV-CONCUR-${Date.now()}`,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 40000,
      },
      testAdmin.id
    );

    // Fire 3 simultaneous payment requests of ₹20,000 each
    // Total requested = ₹60,000, but invoice balance is only ₹40,000
    // Thanks to pessimistic row locking (SELECT ... FOR UPDATE),
    // at most 2 requests (20,000 + 20,000 = 40,000) can succeed, and the 3rd MUST fail!
    const results = await Promise.allSettled([
      FinanceService.recordPayment(
        {
          invoiceId: inv.id,
          amount: 20000,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          transactionReference: `UTR-CONCUR-A-${Date.now()}`,
        },
        testAdmin.id
      ),
      FinanceService.recordPayment(
        {
          invoiceId: inv.id,
          amount: 20000,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          transactionReference: `UTR-CONCUR-B-${Date.now()}`,
        },
        testAdmin.id
      ),
      FinanceService.recordPayment(
        {
          invoiceId: inv.id,
          amount: 20000,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          transactionReference: `UTR-CONCUR-C-${Date.now()}`,
        },
        testAdmin.id
      ),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly 2 succeeded and 1 was rejected
    expect(fulfilled.length).toBe(2);
    expect(rejected.length).toBe(1);

    // Verify invoice final balance is strictly 0 and never negative
    const updatedInv = await prisma.invoice.findUnique({
      where: { id: inv.id },
    });
    expect(Number(updatedInv?.amountPaid)).toBe(40000);
    expect(Number(updatedInv?.remainingBalance)).toBe(0);
    expect(updatedInv?.paymentStatus).toBe(PaymentStatus.PAID);
  });

  it('7. Voiding / reversing an installment restores remaining balance and status with audit log', async () => {
    const client = await createNewTestClient();
    const inv = await FinanceService.createInvoice(
      {
        clientId: client.id,
        invoiceNumber: `INV-VOID-${Date.now()}`,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 50000,
      },
      testAdmin.id
    );

    // Record installment of ₹20,000
    const ref = `UTR-TO-VOID-${Date.now()}`;
    const payRes = await FinanceService.recordPayment(
      {
        invoiceId: inv.id,
        amount: 20000,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        transactionReference: ref,
      },
      testAdmin.id
    );

    expect(Number(payRes.updatedInvoice.remainingBalance)).toBe(30000);
    expect(payRes.updatedInvoice.paymentStatus).toBe(PaymentStatus.PARTIALLY_PAID);

    // Void the installment
    const voidRes = await FinanceService.voidPayment(
      payRes.payment.id,
      'Client cheque bounced on clearance',
      testAdmin.id
    );

    expect(voidRes.payment.isVoided).toBe(true);
    expect(voidRes.payment.voidReason).toBe('Client cheque bounced on clearance');
    expect(Number(voidRes.updatedInvoice.amountPaid)).toBe(0);
    expect(Number(voidRes.updatedInvoice.remainingBalance)).toBe(50000);
    expect(voidRes.updatedInvoice.paymentStatus).toBe(PaymentStatus.NOT_DUE);
  });
});

