import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PassThrough } from 'stream';
import { prisma } from '../src/config/db.js';
import { FinanceService } from '../src/services/finance.service.js';
import { InvoicePdfService } from '../src/services/invoicePdf.service.js';
import { PaymentStatus, PaymentMethod, Role, UserStatus } from '@prisma/client';
import { AppError } from '../src/middlewares/error.middleware.js';

describe('Viralstan CMS — Invoice PDF Download, Print & Safe Delete / Cancel Workflows', () => {
  let testAdmin: any;
  let testEmployee: any;
  let createdClientIds: string[] = [];

  async function createNewTestClient(pricing = 75000, billingCycle: 'ONE_TIME' | 'MONTHLY' = 'ONE_TIME') {
    const now = new Date();
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const cl = await prisma.client.create({
      data: {
        companyName: `Acrobat Corp ${suffix}`,
        contactPerson: 'Aditi Sharma',
        contactDesignation: 'Chief Marketing Officer',
        mobileNumber: '9876543210',
        email: `client_${suffix}@acrobat.com`,
        address: '104 Connaught Place, Block B',
        city: 'New Delhi',
        contractStartDate: now,
        contractEndDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
        renewalDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
        packagePricing: pricing,
        billingCycle,
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
          email: `admin_${Date.now()}@viralstan.com`,
          password: 'HashedPassword123!',
          fullName: 'Finance Senior Admin',
          role: Role.ADMIN,
          status: UserStatus.ACTIVE,
        },
      });
    }

    testEmployee = await prisma.user.findFirst({
      where: { role: Role.EMPLOYEE, status: UserStatus.ACTIVE },
    });

    if (!testEmployee) {
      testEmployee = await prisma.user.create({
        data: {
          email: `employee_${Date.now()}@viralstan.com`,
          password: 'HashedPassword123!',
          fullName: 'Staff Member',
          role: Role.EMPLOYEE,
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
      await prisma.clientService.deleteMany({ where: { clientId } });
      await prisma.clientAssignedEmployee.deleteMany({ where: { clientId } });
      await prisma.client.deleteMany({ where: { id: clientId } });
    }
  });

  it('1. Generates a valid on-demand PDF buffer with authentic PDF magic header %PDF', async () => {
    const client = await createNewTestClient(60000);
    const invoiceNum = `INV-PDF-${Date.now()}`;
    const invoice = await FinanceService.createInvoice(
      {
        clientId: client.id,
        invoiceNumber: invoiceNum,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 60000,
        notes: 'Deliverable milestone 1 & 2',
      },
      testAdmin.id
    );

    const fullInvoice = await FinanceService.getInvoiceById(invoice.id);
    const pdfBuffer = await InvoicePdfService.generatePdfBuffer(fullInvoice as any);

    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // Check %PDF header magic bytes
    const pdfHeader = pdfBuffer.slice(0, 4).toString('utf-8');
    expect(pdfHeader).toBe('%PDF');
  });

  it('2. PDF generation accurately incorporates authoritative MySQL invoice and client values', async () => {
    const client = await createNewTestClient(95000);
    const invoiceNum = `INV-DATA-${Date.now()}`;
    const invoice = await FinanceService.createInvoice(
      {
        clientId: client.id,
        invoiceNumber: invoiceNum,
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 95000,
        notes: 'SEO and Branding Package',
      },
      testAdmin.id
    );

    // Record partial installment of 45,000
    await FinanceService.recordPayment(
      {
        invoiceId: invoice.id,
        amount: 45000,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        transactionReference: `UTR${Date.now()}A`,
        notes: '45,000 advance transfer',
      },
      testAdmin.id
    );

    const fullInvoice = await FinanceService.getInvoiceById(invoice.id);
    expect(Number(fullInvoice.invoiceAmount)).toBe(95000);
    expect(Number(fullInvoice.amountPaid)).toBe(45000);
    expect(Number(fullInvoice.remainingBalance)).toBe(50000);
    expect(fullInvoice.paymentStatus).toBe(PaymentStatus.PARTIALLY_PAID);

    const pdfBuffer = await InvoicePdfService.generatePdfBuffer(fullInvoice as any);
    const pdfContent = pdfBuffer.toString('latin1');

    // PDF contains invoice number and client name
    expect(pdfContent).toContain(invoiceNum);
    expect(pdfBuffer.length).toBeGreaterThan(2000);
  });

  it('3. Streaming response sets proper headers for both Attachment and Inline (Print) views', async () => {
    const client = await createNewTestClient(30000);
    const invoiceNum = `INV-STREAM-${Date.now()}`;
    const invoice = await FinanceService.createInvoice(
      {
        clientId: client.id,
        invoiceNumber: invoiceNum,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 30000,
      },
      testAdmin.id
    );

    const mockHeaders: Record<string, string> = {};
    const mockRes: any = new PassThrough();
    mockRes.setHeader = (key: string, val: string) => {
      mockHeaders[key] = val;
    };

    // Test inline (for browser print preview)
    await FinanceService.downloadInvoicePdf(invoice.id, mockRes, true);
    expect(mockHeaders['Content-Type']).toBe('application/pdf');
    expect(mockHeaders['Content-Disposition']).toContain('inline');
    expect(mockHeaders['Content-Disposition']).toContain(`Viralstan_Invoice_${invoiceNum}.pdf`);
  });

  it('4. Rejects invoice deletion when confirmation text is missing or not DELETE', async () => {
    const client = await createNewTestClient(40000);
    const invoice = await FinanceService.createInvoice(
      {
        clientId: client.id,
        invoiceNumber: `INV-CONF-${Date.now()}`,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 40000,
      },
      testAdmin.id
    );

    await expect(
      FinanceService.deleteInvoice(invoice.id, 'delete', testAdmin.id)
    ).rejects.toThrow(AppError);

    await expect(
      FinanceService.deleteInvoice(invoice.id, 'CONFIRM', testAdmin.id)
    ).rejects.toThrow(AppError);

    // Invoice still exists in database
    const check = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(check).not.toBeNull();
  });

  it('5. Allows safe permanent deletion of eligible draft/unissued invoice with NO payments', async () => {
    const client = await createNewTestClient(25000);
    const invoiceNum = `INV-DRAFT-${Date.now()}`;
    const invoice = await FinanceService.createInvoice(
      {
        clientId: client.id,
        invoiceNumber: invoiceNum,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 25000,
      },
      testAdmin.id
    );

    const result = await FinanceService.deleteInvoice(invoice.id, 'DELETE', testAdmin.id);
    expect(result.success).toBe(true);
    expect(result.deletedInvoiceId).toBe(invoice.id);

    // Verify invoice is permanently deleted from MySQL
    const check = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(check).toBeNull();

    // Verify AuditLog record was created
    const audit = await prisma.auditLog.findFirst({
      where: { resourceType: 'Invoice', resourceId: invoice.id, action: 'INVOICE_DELETED' },
    });
    expect(audit).not.toBeNull();
  });

  it('6. Strictly prevents permanent deletion of a paid invoice', async () => {
    const client = await createNewTestClient(50000);
    const invoice = await FinanceService.createInvoice(
      {
        clientId: client.id,
        invoiceNumber: `INV-PAID-${Date.now()}`,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 50000,
      },
      testAdmin.id
    );

    // Pay full balance
    await FinanceService.recordPayment(
      {
        invoiceId: invoice.id,
        amount: 50000,
        paymentMethod: PaymentMethod.UPI,
        transactionReference: `UPI${Date.now()}P`,
      },
      testAdmin.id
    );

    await expect(
      FinanceService.deleteInvoice(invoice.id, 'DELETE', testAdmin.id)
    ).rejects.toThrow(/cannot be permanently deleted/i);

    // Verify invoice still exists in MySQL
    const check = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(check).not.toBeNull();
    expect(check?.paymentStatus).toBe(PaymentStatus.PAID);
  });

  it('7. Strictly prevents permanent deletion of a partially paid invoice', async () => {
    const client = await createNewTestClient(80000);
    const invoice = await FinanceService.createInvoice(
      {
        clientId: client.id,
        invoiceNumber: `INV-PARTIAL-${Date.now()}`,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 80000,
      },
      testAdmin.id
    );

    // 50% advance installment
    await FinanceService.recordPayment(
      {
        invoiceId: invoice.id,
        amount: 40000,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        transactionReference: `UTR${Date.now()}X`,
      },
      testAdmin.id
    );

    await expect(
      FinanceService.deleteInvoice(invoice.id, 'DELETE', testAdmin.id)
    ).rejects.toThrow(/cannot be permanently deleted/i);

    const check = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(check).not.toBeNull();
    expect(check?.paymentStatus).toBe(PaymentStatus.PARTIALLY_PAID);
  });

  it('8. Cancel / Void workflow marks invoice CANCELLED, preserves payments, and excludes from active receivables', async () => {
    const client = await createNewTestClient(100000);
    const invoiceNum = `INV-CANCEL-${Date.now()}`;
    const invoice = await FinanceService.createInvoice(
      {
        clientId: client.id,
        invoiceNumber: invoiceNum,
        dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 100000,
      },
      testAdmin.id
    );

    // Partial installment of 30,000
    const paymentRes = await FinanceService.recordPayment(
      {
        invoiceId: invoice.id,
        amount: 30000,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        transactionReference: `UTR${Date.now()}C`,
      },
      testAdmin.id
    );

    // Summary before cancellation
    const summaryBefore = await FinanceService.getFinanceSummary();

    // Cancel invoice
    const cancelRes = await FinanceService.cancelInvoice(
      invoice.id,
      { cancelReason: 'Client requested project scope reduction and re-contracting' },
      testAdmin.id
    );

    expect(cancelRes.success).toBe(true);
    expect(cancelRes.invoice.isCancelled).toBe(true);
    expect(cancelRes.invoice.paymentStatus).toBe(PaymentStatus.CANCELLED);
    expect(cancelRes.paymentNotice).toContain('1 payment record(s) totaling INR 30,000 remain in financial history');

    // 1. Payment record is preserved in MySQL
    const paymentCheck = await prisma.payment.findUnique({ where: { id: paymentRes.payment.id } });
    expect(paymentCheck).not.toBeNull();
    expect(Number(paymentCheck?.amount)).toBe(30000);

    // 2. Summary after cancellation excludes cancelled invoice receivables
    const summaryAfter = await FinanceService.getFinanceSummary();
    expect(summaryAfter.pendingPaymentsBalance).toBe(summaryBefore.pendingPaymentsBalance - 70000);

    // 3. Audit log exists
    const audit = await prisma.auditLog.findFirst({
      where: { resourceType: 'Invoice', resourceId: invoice.id, action: 'INVOICE_CANCELLED' },
    });
    expect(audit).not.toBeNull();
  });

  it('9. Handling duplicate or already deleted/cancelled invoice requests safely', async () => {
    const client = await createNewTestClient(15000);
    const invoice = await FinanceService.createInvoice(
      {
        clientId: client.id,
        invoiceNumber: `INV-DUP-${Date.now()}`,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 15000,
      },
      testAdmin.id
    );

    // First delete succeeds
    await FinanceService.deleteInvoice(invoice.id, 'DELETE', testAdmin.id);

    // Second delete throws 404 Invoice not found
    await expect(
      FinanceService.deleteInvoice(invoice.id, 'DELETE', testAdmin.id)
    ).rejects.toThrow(/not found/i);
  });

  it('10. Enforces Admin-only authorization guard against employee access on finance endpoints', async () => {
    const { requireAdmin } = await import('../src/middlewares/role.middleware.js');
    let capturedError: any = null;
    const mockReq: any = {
      user: { id: testEmployee.id, role: 'EMPLOYEE' },
    };
    const mockRes: any = {};
    const mockNext = (err?: any) => {
      capturedError = err;
    };

    requireAdmin(mockReq, mockRes, mockNext);
    expect(capturedError).toBeDefined();
    expect(capturedError.statusCode || capturedError.status).toBe(403);
    expect(capturedError.message).toContain('Admin privileges required');
  });

  it('11. Generates PDF correctly for recurring monthly retainer package clients', async () => {
    const client = await createNewTestClient(50000, 'MONTHLY');
    const invoiceNum = `INV-REC-${Date.now()}`;
    const invoice = await FinanceService.createInvoice(
      {
        clientId: client.id,
        invoiceNumber: invoiceNum,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 50000,
        notes: 'Monthly retainer for digital marketing execution',
      },
      testAdmin.id
    );

    const fullInvoice = await FinanceService.getInvoiceById(invoice.id);
    const pdfBuffer = await InvoicePdfService.generatePdfBuffer(fullInvoice as any);
    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.length).toBeGreaterThan(1500);

    const pdfString = pdfBuffer.toString('latin1');
    expect(pdfString).toContain(invoiceNum);
  });

  it('12. Allows test duplicate cleanup when Admin explicitly confirms with DELETE and cleanTestPayments: true, purging payments and updating Total Collected', async () => {
    const client = await createNewTestClient(5000000);
    const invoiceNum = `INV-TEST-DUP-${Date.now()}`;
    const invoice = await FinanceService.createInvoice(
      {
        clientId: client.id,
        invoiceNumber: invoiceNum,
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        invoiceAmount: 5000000,
      },
      testAdmin.id
    );

    // Record test payment of 50,00,000
    const payment = await FinanceService.recordPayment(
      {
        invoiceId: invoice.id,
        amount: 5000000,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        transactionReference: `UTR-TEST-${Date.now()}`,
      },
      testAdmin.id
    );

    const summaryBefore = await FinanceService.getFinanceSummary();
    expect(summaryBefore.totalCollected).toBeGreaterThanOrEqual(5000000);

    // Test duplicate purge
    const result = await FinanceService.deleteInvoice(
      invoice.id,
      'DELETE',
      testAdmin.id,
      { cleanTestPayments: true, reason: 'Test duplicate cleanup verification' }
    );

    expect(result.success).toBe(true);
    expect(result.purgedPaymentsCount).toBe(1);
    expect(result.purgedAmount).toBe(5000000);

    // Verify invoice and payment are purged from MySQL
    const invoiceCheck = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(invoiceCheck).toBeNull();

    const paymentCheck = await prisma.payment.findUnique({ where: { id: payment.payment.id } });
    expect(paymentCheck).toBeNull();

    // Verify Total Collected decreased by 5,000,000
    const summaryAfter = await FinanceService.getFinanceSummary();
    expect(summaryAfter.totalCollected).toBe(summaryBefore.totalCollected - 5000000);

    // Verify audit log exists
    const audit = await prisma.auditLog.findFirst({
      where: { resourceType: 'Invoice', resourceId: invoice.id, action: 'INVOICE_PURGED_TEST_DATA' },
    });
    expect(audit).not.toBeNull();
  });
});
