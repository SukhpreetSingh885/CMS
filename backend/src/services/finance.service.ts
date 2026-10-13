import { Prisma, PaymentStatus, PaymentMethod, RenewalStatus } from '@prisma/client';
import { Response } from 'express';
import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.middleware.js';
import { AuditService } from './audit.service.js';
import { buildPrismaDateFilter } from '../utils/dateRange.js';
import { InvoicePdfService } from './invoicePdf.service.js';

export class FinanceService {
  /**
   * List all invoices with client information, payments, and smart filters
   */
  static async listInvoices(query: {
    clientId?: string;
    status?: PaymentStatus;
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    dateFrom?: string;
    dateTo?: string;
    dueDateFrom?: string;
    dueDateTo?: string;
    isOverdue?: boolean | string;
    minAmount?: number;
    maxAmount?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10));
    const skip = (page - 1) * pageSize;

    const where: Prisma.InvoiceWhereInput = {};

    if (query.clientId) where.clientId = query.clientId;
    if (query.status) where.paymentStatus = query.status;

    const invoiceDateFilter = buildPrismaDateFilter({
      dateRange: query.dateRange,
      startDate: query.startDate || query.dateFrom,
      endDate: query.endDate || query.dateTo,
    });
    if (invoiceDateFilter) {
      where.invoiceDate = invoiceDateFilter;
    }

    if (query.dueDateFrom || query.dueDateTo) {
      where.dueDate = {};
      if (query.dueDateFrom) where.dueDate.gte = new Date(query.dueDateFrom);
      if (query.dueDateTo) {
        const to = new Date(query.dueDateTo);
        to.setHours(23, 59, 59, 999);
        where.dueDate.lte = to;
      }
    }

    if (query.isOverdue === true || query.isOverdue === 'true') {
      where.paymentStatus = { not: PaymentStatus.PAID };
      where.dueDate = { lt: new Date() };
    }

    if (query.minAmount !== undefined || query.maxAmount !== undefined) {
      where.invoiceAmount = {};
      if (query.minAmount !== undefined) where.invoiceAmount.gte = Number(query.minAmount);
      if (query.maxAmount !== undefined) where.invoiceAmount.lte = Number(query.maxAmount);
    }

    if (query.search) {
      where.OR = [
        { invoiceNumber: { contains: query.search } },
        { client: { companyName: { contains: query.search } } },
        { client: { contactPerson: { contains: query.search } } },
        { client: { email: { contains: query.search } } },
      ];
    }

    const validSortFields = ['dueDate', 'invoiceDate', 'invoiceAmount', 'amountPaid', 'remainingBalance', 'paymentStatus', 'createdAt'];
    const sortBy = query.sortBy && validSortFields.includes(query.sortBy) ? query.sortBy : 'dueDate';
    const sortOrder: Prisma.SortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';
    const orderBy: Prisma.InvoiceOrderByWithRelationInput[] = [
      { [sortBy]: sortOrder },
      { createdAt: 'desc' },
    ];

    const [total, invoices] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          client: {
            select: { id: true, companyName: true, contactPerson: true, email: true },
          },
          payments: {
            where: { isVoided: false },
            orderBy: { paymentDate: 'desc' },
            include: {
              receivedBy: { select: { id: true, fullName: true } },
            },
          },
        },
      }),
    ]);

    return { total, page, pageSize, invoices };
  }

  /**
   * Get single invoice by ID
   */
  static async getInvoiceById(id: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: {
          include: {
            package: true,
            services: {
              include: { service: true },
            },
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
          include: {
            receivedBy: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    return invoice;
  }

  /**
   * Create invoice
   */
  static async createInvoice(
    data: {
      clientId: string;
      invoiceNumber: string;
      invoiceDate?: string;
      dueDate: string;
      packageValue?: number;
      invoiceAmount: number;
      notes?: string | null;
    },
    creatorId: string,
    meta?: { ipAddress?: string }
  ) {
    const existing = await prisma.invoice.findUnique({
      where: { invoiceNumber: data.invoiceNumber },
    });
    if (existing) {
      throw new AppError('An invoice with this invoice number already exists.', 409);
    }

    // Duplicate submission guard: reject creating duplicate pending invoices for the same client and amount within 5 minutes
    const recentDuplicate = await prisma.invoice.findFirst({
      where: {
        clientId: data.clientId,
        invoiceAmount: data.invoiceAmount,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000),
        },
      },
    });
    if (recentDuplicate) {
      throw new AppError(
        `An identical invoice (${recentDuplicate.invoiceNumber}) for ₹${data.invoiceAmount} was created recently for this client. Please review existing invoices before creating a new one.`,
        409
      );
    }

    const dueDate = new Date(data.dueDate);
    const now = new Date();
    const isPastDue = dueDate < now;
    const paymentStatus = isPastDue ? PaymentStatus.OVERDUE : PaymentStatus.NOT_DUE;

    const invoice = await prisma.invoice.create({
      data: {
        clientId: data.clientId,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
        dueDate,
        packageValue: data.packageValue || data.invoiceAmount,
        invoiceAmount: data.invoiceAmount,
        amountPaid: 0,
        remainingBalance: data.invoiceAmount,
        paymentStatus,
        notes: data.notes,
      },
      include: { client: true },
    });

    const creator = await prisma.user.findUnique({ where: { id: creatorId } });
    await AuditService.log({
      actorId: creatorId,
      actorName: creator?.fullName,
      actorEmail: creator?.email,
      action: 'INVOICE_CREATED',
      resourceType: 'INVOICE',
      resourceId: invoice.id,
      afterState: invoice,
      ipAddress: meta?.ipAddress,
    });

    return invoice;
  }

  /**
   * Stream invoice PDF to response
   */
  static async downloadInvoicePdf(id: string, res: Response, inline = false) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: {
          include: {
            package: true,
            services: {
              include: { service: true },
            },
          },
        },
        payments: {
          where: { isVoided: false },
          orderBy: { paymentDate: 'desc' },
          include: {
            receivedBy: { select: { fullName: true } },
          },
        },
      },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    return InvoicePdfService.streamToResponse(invoice as any, res, inline);
  }

  /**
   * Safe permanent deletion of eligible unissued/draft invoice or authorized test duplicate cleanup
   */
  static async deleteInvoice(
    id: string,
    confirmation: string,
    actorId: string,
    optionsOrMeta?: { cleanTestPayments?: boolean; reason?: string; ipAddress?: string },
    possibleMeta?: { ipAddress?: string }
  ) {
    if (confirmation !== 'DELETE') {
      throw new AppError('Confirmation word "DELETE" must be typed exactly to confirm deletion', 400);
    }

    const options = {
      cleanTestPayments: Boolean(optionsOrMeta?.cleanTestPayments),
      reason: optionsOrMeta?.reason,
    };
    const ipAddress = possibleMeta?.ipAddress || optionsOrMeta?.ipAddress;

    return prisma.$transaction(async (tx) => {
      // 1. Concurrency lock on invoice row
      const [locked]: any = await tx.$queryRaw`SELECT id, invoiceNumber, paymentStatus, invoiceAmount, amountPaid, isCancelled FROM Invoice WHERE id = ${id} FOR UPDATE`;
      if (!locked) {
        throw new AppError('Invoice not found', 404);
      }

      // 2. Fetch invoice with all linked payments (including voided)
      const invoice = await tx.invoice.findUnique({
        where: { id },
        include: {
          payments: true,
          client: { select: { id: true, companyName: true } },
        },
      });

      if (!invoice) {
        throw new AppError('Invoice not found', 404);
      }

      const hasPayments = Boolean(invoice.payments && invoice.payments.length > 0);
      const hasPaidAmount = Number(invoice.amountPaid) > 0;
      const isPaidStatus =
        invoice.paymentStatus === PaymentStatus.PAID ||
        invoice.paymentStatus === PaymentStatus.PARTIALLY_PAID;

      // 3. Deletion validation and test cleanup branch
      if (hasPayments || hasPaidAmount || isPaidStatus) {
        if (!options.cleanTestPayments) {
          throw new AppError(
            `Invoice ${invoice.invoiceNumber} cannot be permanently deleted without explicit test duplicate purge authorization. It has ${invoice.payments?.length || 0} payment record(s) totaling INR ${Number(invoice.amountPaid).toLocaleString('en-IN')}. To permanently purge this test duplicate, select "Purge test data duplicate" and confirm with DELETE, or use Cancel / Void Invoice instead.`,
            400
          );
        }

        // Test duplicate cleanup explicitly authorized by Admin: purge linked payments and invoice
        const paymentCount = invoice.payments?.length || 0;
        const totalPaymentsPurged =
          invoice.payments?.reduce(
            (acc, p) => acc + (p.isVoided ? 0 : Number(p.amount)),
            0
          ) || 0;

        // Delete all linked payments for this invoice
        await tx.payment.deleteMany({
          where: { invoiceId: id },
        });

        // Audit Log for test duplicate cleanup
        await AuditService.log({
          actorId,
          action: 'INVOICE_PURGED_TEST_DATA',
          resourceType: 'Invoice',
          resourceId: id,
          beforeState: JSON.stringify({
            invoiceNumber: invoice.invoiceNumber,
            client: invoice.client?.companyName,
            invoiceAmount: invoice.invoiceAmount,
            amountPaid: invoice.amountPaid,
            paymentsCount: paymentCount,
            totalPaymentsPurged,
            reason: options.reason || 'Test duplicate cleanup authorized by Admin',
          }),
          ipAddress,
        });

        // Delete the invoice itself
        await tx.invoice.delete({
          where: { id },
        });

        return {
          success: true,
          message: `Invoice ${invoice.invoiceNumber} and ${paymentCount} test payment record(s) totaling ₹${totalPaymentsPurged.toLocaleString('en-IN')} have been safely purged. Financial totals updated.`,
          deletedInvoiceId: id,
          invoiceNumber: invoice.invoiceNumber,
          purgedPaymentsCount: paymentCount,
          purgedAmount: totalPaymentsPurged,
        };
      }

      // 4. Eligible unpaid draft invoice with 0 payments
      await AuditService.log({
        actorId,
        action: 'INVOICE_DELETED',
        resourceType: 'Invoice',
        resourceId: id,
        beforeState: JSON.stringify(invoice),
        ipAddress,
      });

      // 5. Delete invoice record safely
      await tx.invoice.delete({
        where: { id },
      });

      return {
        success: true,
        message: `Invoice ${invoice.invoiceNumber} has been permanently and safely deleted.`,
        deletedInvoiceId: id,
        invoiceNumber: invoice.invoiceNumber,
      };
    });
  }

  /**
   * Cancel / Void issued invoice while strictly preserving all financial history
   */
  static async cancelInvoice(
    id: string,
    data: { cancelReason: string },
    actorId: string,
    meta?: { ipAddress?: string }
  ) {
    if (!data.cancelReason || data.cancelReason.trim().length < 5) {
      throw new AppError('Cancellation reason must be at least 5 characters', 400);
    }

    return prisma.$transaction(async (tx) => {
      // 1. Concurrency lock on invoice row
      const [locked]: any = await tx.$queryRaw`SELECT id, invoiceNumber, paymentStatus, isCancelled FROM Invoice WHERE id = ${id} FOR UPDATE`;
      if (!locked) {
        throw new AppError('Invoice not found', 404);
      }

      const invoice = await tx.invoice.findUnique({
        where: { id },
        include: {
          payments: { where: { isVoided: false } },
          client: { select: { id: true, companyName: true } },
        },
      });

      if (!invoice) {
        throw new AppError('Invoice not found', 404);
      }

      if (invoice.isCancelled || invoice.paymentStatus === PaymentStatus.CANCELLED || invoice.paymentStatus === PaymentStatus.VOID) {
        throw new AppError(`Invoice ${invoice.invoiceNumber} is already cancelled / voided.`, 400);
      }

      // 2. Update status and cancellation metadata
      const updated = await tx.invoice.update({
        where: { id },
        data: {
          isCancelled: true,
          cancelReason: data.cancelReason.trim(),
          cancelledAt: new Date(),
          cancelledById: actorId,
          paymentStatus: PaymentStatus.CANCELLED,
        },
        include: {
          client: { select: { id: true, companyName: true } },
          payments: {
            where: { isVoided: false },
            select: { id: true, amount: true, paymentMethod: true, transactionReference: true },
          },
        },
      });

      // 3. Audit log
      await AuditService.log({
        actorId,
        action: 'INVOICE_CANCELLED',
        resourceType: 'Invoice',
        resourceId: id,
        beforeState: JSON.stringify(invoice),
        afterState: JSON.stringify(updated),
        ipAddress: meta?.ipAddress,
      });

      const totalPaid = Number(invoice.amountPaid || 0);
      const paymentCount = updated.payments.length;
      let paymentNotice: string | null = null;
      if (totalPaid > 0 || paymentCount > 0) {
        paymentNotice = `Invoice cancelled. ${paymentCount} payment record(s) totaling INR ${totalPaid.toLocaleString('en-IN')} remain in financial history. Process a refund, credit note, or reallocation if necessary.`;
      }

      return {
        success: true,
        message: `Invoice ${invoice.invoiceNumber} has been successfully cancelled / voided.`,
        invoice: updated,
        paymentNotice,
      };
    });
  }

  /**
   * Record payment against an invoice and compute updated status & balance atomically
   * Supports unlimited partial / installment payments with pessimistic concurrency locks
   */
  static async recordPayment(
    data: {
      invoiceId: string;
      amount: number;
      paymentDate?: string;
      paymentMethod?: PaymentMethod;
      transactionReference?: string | null;
      notes?: string | null;
    },
    receivedById: string,
    meta?: { ipAddress?: string }
  ) {
    if (!data.amount || data.amount <= 0) {
      throw new AppError('Payment amount must be greater than 0', 400);
    }

    const trimmedRef = data.transactionReference?.trim();
    if (trimmedRef) {
      const existingPaymentWithRef = await prisma.payment.findFirst({
        where: { transactionReference: trimmedRef, isVoided: false },
        include: { invoice: true },
      });
      if (existingPaymentWithRef) {
        throw new AppError(
          `A payment with transaction reference "${trimmedRef}" has already been recorded on invoice ${existingPaymentWithRef.invoice?.invoiceNumber || existingPaymentWithRef.invoiceId}. Duplicate payment rejected.`,
          409
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Pessimistic row lock to prevent race conditions & concurrent overpayment
      await tx.$queryRaw`SELECT id FROM Invoice WHERE id = ${data.invoiceId} FOR UPDATE`;

      const lockedInvoice = await tx.invoice.findUnique({
        where: { id: data.invoiceId },
      });
      if (!lockedInvoice) {
        throw new AppError('Invoice not found', 404);
      }

      // 2. Compute current valid (non-voided) payments sum inside the transaction
      const currentAgg = await tx.payment.aggregate({
        where: { invoiceId: data.invoiceId, isVoided: false },
        _sum: { amount: true },
      });
      const currentTotalPaid = Number(currentAgg._sum.amount || 0);
      const totalInvoiceAmount = Number(lockedInvoice.invoiceAmount);
      const currentRemaining = Math.max(0, totalInvoiceAmount - currentTotalPaid);

      if (currentRemaining <= 0 || lockedInvoice.paymentStatus === PaymentStatus.PAID) {
        throw new AppError(
          `Invoice ${lockedInvoice.invoiceNumber} has already been fully paid and settled.`,
          400
        );
      }

      if (data.amount > currentRemaining) {
        throw new AppError(
          `Payment amount (₹${data.amount}) cannot exceed remaining balance (₹${currentRemaining}) for invoice ${lockedInvoice.invoiceNumber}.`,
          400
        );
      }

      // 3. Create the payment installment
      const payment = await tx.payment.create({
        data: {
          invoiceId: data.invoiceId,
          clientId: lockedInvoice.clientId,
          amount: data.amount,
          paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
          paymentMethod: data.paymentMethod || PaymentMethod.BANK_TRANSFER,
          transactionReference: trimmedRef || null,
          receivedById,
          notes: data.notes?.trim() || null,
          isVoided: false,
        },
      });

      // 4. Recalculate true sum of all non-voided payments for this invoice
      const paymentsAgg = await tx.payment.aggregate({
        where: { invoiceId: data.invoiceId, isVoided: false },
        _sum: { amount: true },
      });
      const exactAmountPaid = Number(paymentsAgg._sum.amount || 0);
      const exactRemainingBalance = Math.max(0, totalInvoiceAmount - exactAmountPaid);

      let newStatus: PaymentStatus;
      if (exactRemainingBalance <= 0) {
        newStatus = PaymentStatus.PAID;
      } else if (exactAmountPaid > 0) {
        newStatus = PaymentStatus.PARTIALLY_PAID;
      } else if (lockedInvoice.dueDate < new Date()) {
        newStatus = PaymentStatus.OVERDUE;
      } else {
        newStatus = PaymentStatus.NOT_DUE;
      }

      const updatedInvoice = await tx.invoice.update({
        where: { id: data.invoiceId },
        data: {
          amountPaid: exactAmountPaid,
          remainingBalance: exactRemainingBalance,
          paymentStatus: newStatus,
        },
        include: { client: true },
      });

      return { payment, updatedInvoice };
    });

    const receiver = await prisma.user.findUnique({ where: { id: receivedById } });
    await AuditService.log({
      actorId: receivedById,
      actorName: receiver?.fullName,
      actorEmail: receiver?.email,
      action: 'PAYMENT_RECORDED',
      resourceType: 'PAYMENT',
      resourceId: result.payment.id,
      afterState: result,
      ipAddress: meta?.ipAddress,
    });

    return result;
  }

  /**
   * Void / reverse a recorded payment with audit trail and balance recalculation
   */
  static async voidPayment(
    paymentId: string,
    voidReason: string,
    actorId: string,
    meta?: { ipAddress?: string }
  ) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: true },
    });
    if (!payment) {
      throw new AppError('Payment not found', 404);
    }
    if (payment.isVoided) {
      throw new AppError('Payment has already been voided', 400);
    }
    if (!voidReason || voidReason.trim().length === 0) {
      throw new AppError('A reason is required to void/reverse a payment', 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock invoice row
      await tx.$queryRaw`SELECT id FROM Invoice WHERE id = ${payment.invoiceId} FOR UPDATE`;

      // 2. Mark payment as voided
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          isVoided: true,
          voidReason: voidReason.trim(),
          voidedAt: new Date(),
          voidedById: actorId,
        },
      });

      // 3. Recalculate invoice remaining balance from remaining non-voided payments
      const paymentsAgg = await tx.payment.aggregate({
        where: { invoiceId: payment.invoiceId, isVoided: false },
        _sum: { amount: true },
      });
      const exactAmountPaid = Number(paymentsAgg._sum.amount || 0);
      const totalInvoiceAmount = Number(payment.invoice.invoiceAmount);
      const exactRemainingBalance = Math.max(0, totalInvoiceAmount - exactAmountPaid);

      let newStatus: PaymentStatus;
      if (exactRemainingBalance <= 0) {
        newStatus = PaymentStatus.PAID;
      } else if (exactAmountPaid > 0) {
        newStatus = PaymentStatus.PARTIALLY_PAID;
      } else if (payment.invoice.dueDate < new Date()) {
        newStatus = PaymentStatus.OVERDUE;
      } else {
        newStatus = PaymentStatus.NOT_DUE;
      }

      const updatedInvoice = await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          amountPaid: exactAmountPaid,
          remainingBalance: exactRemainingBalance,
          paymentStatus: newStatus,
        },
        include: { client: true },
      });

      return { payment: updatedPayment, updatedInvoice };
    });

    const actor = await prisma.user.findUnique({ where: { id: actorId } });
    await AuditService.log({
      actorId,
      actorName: actor?.fullName,
      actorEmail: actor?.email,
      action: 'PAYMENT_VOIDED',
      resourceType: 'PAYMENT',
      resourceId: paymentId,
      beforeState: payment,
      afterState: result,
      ipAddress: meta?.ipAddress,
    });

    return result;
  }

  /**
   * List renewals and handle 30d/7d alert checks with smart filters
   */
  static async listRenewals(query: {
    status?: RenewalStatus;
    clientId?: string;
    window?: '7days' | '30days' | 'overdue' | 'due' | 'all';
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    renewalDateFrom?: string;
    renewalDateTo?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}) {
    const where: any = {};
    if (query.status) where.renewalStatus = query.status;
    if (query.clientId) where.clientId = query.clientId;

    const renewalFilter = buildPrismaDateFilter({
      dateRange: query.dateRange,
      startDate: query.startDate || query.renewalDateFrom,
      endDate: query.endDate || query.renewalDateTo,
    });
    if (renewalFilter) {
      where.renewalDate = renewalFilter;
    }

    if (query.search) {
      where.client = {
        OR: [
          { companyName: { contains: query.search } },
          { contactPerson: { contains: query.search } },
          { email: { contains: query.search } },
        ],
      };
    }

    const renewals = await prisma.renewal.findMany({
      where,
      orderBy: { renewalDate: 'asc' },
      include: {
        client: {
          select: {
            id: true,
            companyName: true,
            contactPerson: true,
            email: true,
            mobileNumber: true,
            package: { select: { name: true } },
          },
        },
      },
    });

    const now = new Date();
    let results = renewals.map((r) => {
      const diffMs = r.renewalDate.getTime() - now.getTime();
      const daysUntilRenewal = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const isDueSoon = daysUntilRenewal <= 30 && daysUntilRenewal > 0;
      const isOverdue = daysUntilRenewal <= 0;

      return {
        ...r,
        daysUntilRenewal,
        isDueSoon,
        isOverdue,
      };
    });

    if (query.window === '7days') {
      results = results.filter((r) => r.daysUntilRenewal <= 7 && r.daysUntilRenewal > 0);
    } else if (query.window === '30days') {
      results = results.filter((r) => r.daysUntilRenewal <= 30 && r.daysUntilRenewal > 0);
    } else if (query.window === 'overdue') {
      results = results.filter((r) => r.daysUntilRenewal <= 0);
    } else if (query.window === 'due') {
      results = results.filter((r) => r.daysUntilRenewal <= 30);
    }

    if (query.sortBy === 'renewalAmount') {
      results.sort((a, b) => {
        const diff = Number(a.renewalAmount) - Number(b.renewalAmount);
        return query.sortOrder === 'desc' ? -diff : diff;
      });
    } else if (query.sortBy === 'daysUntilRenewal') {
      results.sort((a, b) => {
        const diff = a.daysUntilRenewal - b.daysUntilRenewal;
        return query.sortOrder === 'desc' ? -diff : diff;
      });
    } else if (query.sortOrder === 'desc') {
      results.reverse();
    }

    return results;
  }

  /**
   * Update renewal status
   */
  static async updateRenewal(
    id: string,
    data: {
      contractStartDate?: string;
      contractEndDate?: string;
      renewalDate?: string;
      renewalAmount?: number;
      renewalStatus?: RenewalStatus;
      notes?: string | null;
    }
  ) {
    const updateData: any = {};
    if (data.contractStartDate) updateData.contractStartDate = new Date(data.contractStartDate);
    if (data.contractEndDate) updateData.contractEndDate = new Date(data.contractEndDate);
    if (data.renewalDate) updateData.renewalDate = new Date(data.renewalDate);
    if (data.renewalAmount !== undefined) updateData.renewalAmount = data.renewalAmount;
    if (data.renewalStatus) updateData.renewalStatus = data.renewalStatus;
    if (data.notes !== undefined) updateData.notes = data.notes;

    return prisma.renewal.update({
      where: { id },
      data: updateData,
      include: { client: true },
    });
  }

  /**
   * List confirmed payments with search, date range, client, and pagination
   */
  static async listPayments(query: {
    clientId?: string;
    invoiceId?: string;
    paymentMethod?: PaymentMethod;
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  } = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.PaymentWhereInput = {
      isVoided: false,
    };

    if (query.clientId) where.clientId = query.clientId;
    if (query.invoiceId) where.invoiceId = query.invoiceId;
    if (query.paymentMethod) where.paymentMethod = query.paymentMethod;

    const paymentDateFilter = buildPrismaDateFilter({
      dateRange: query.dateRange,
      startDate: query.startDate || query.dateFrom,
      endDate: query.endDate || query.dateTo,
    });
    if (paymentDateFilter) {
      where.paymentDate = paymentDateFilter;
    }

    if (query.search) {
      where.OR = [
        { transactionReference: { contains: query.search } },
        { invoice: { invoiceNumber: { contains: query.search } } },
        { client: { companyName: { contains: query.search } } },
        { notes: { contains: query.search } },
      ];
    }

    const sortOrder: Prisma.SortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, payments, agg] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ paymentDate: sortOrder }, { createdAt: 'desc' }],
        include: {
          client: {
            select: { id: true, companyName: true, contactPerson: true, email: true },
          },
          invoice: {
            select: { id: true, invoiceNumber: true, invoiceAmount: true, paymentStatus: true, remainingBalance: true },
          },
          receivedBy: {
            select: { id: true, fullName: true, email: true },
          },
        },
      }),
      prisma.payment.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      payments,
      totalAmount: Number(agg._sum.amount || 0),
    };
  }

  /**
   * Calculate Total Received Money strictly from valid client payments stored in MySQL.
   * Excludes voided/reversed payments and cancelled invoices.
   * Subtracts any refunds according to their financial effect.
   * Supports filtering by paymentDate presets: Today, Yesterday, This Week, This Month, This Quarter, This Year, Custom, All Time.
   */
  static async calculateReceivedMoney(filters?: {
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    // 1. Fetch all non-voided payments with invoice and client info
    const payments = await prisma.payment.findMany({
      where: {
        isVoided: false,
        invoice: {
          isCancelled: false,
          paymentStatus: { notIn: [PaymentStatus.CANCELLED, PaymentStatus.VOID] },
        },
      },
      select: {
        id: true,
        amount: true,
        paymentDate: true,
        createdAt: true,
        paymentMethod: true,
        transactionReference: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            invoiceAmount: true,
            packageValue: true,
            client: {
              select: {
                id: true,
                companyName: true,
                billingCycle: true,
              },
            },
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    // 2. All-time calculations
    let allTimeReceivedMoney = 0;
    let allTimeOneTime = 0;
    let allTimeRecurring = 0;
    let allTimeRefunds = 0;

    payments.forEach((p) => {
      const amt = Number(p.amount || 0);
      if (amt < 0) {
        allTimeRefunds += Math.abs(amt);
        allTimeReceivedMoney += amt;
      } else {
        allTimeReceivedMoney += amt;
        if (p.invoice?.client?.billingCycle === 'ONE_TIME') {
          allTimeOneTime += amt;
        } else {
          allTimeRecurring += amt;
        }
      }
    });

    // 3. Filter boundary for selected timeline
    const activeFilter = filters
      ? {
          dateRange: filters.dateRange,
          startDate: filters.startDate || filters.dateFrom,
          endDate: filters.endDate || filters.dateTo,
        }
      : undefined;

    const boundary = activeFilter ? buildPrismaDateFilter(activeFilter) : undefined;

    let periodPayments = payments;
    if (boundary) {
      periodPayments = payments.filter((p) => {
        const pDate = new Date(p.paymentDate);
        if (boundary.gte && pDate < boundary.gte) return false;
        if (boundary.lte && pDate > boundary.lte) return false;
        return true;
      });
    }

    let periodReceivedMoney = 0;
    let periodOneTime = 0;
    let periodRecurring = 0;
    let periodRefunds = 0;

    periodPayments.forEach((p) => {
      const amt = Number(p.amount || 0);
      if (amt < 0) {
        periodRefunds += Math.abs(amt);
        periodReceivedMoney += amt;
      } else {
        periodReceivedMoney += amt;
        if (p.invoice?.client?.billingCycle === 'ONE_TIME') {
          periodOneTime += amt;
        } else {
          periodRecurring += amt;
        }
      }
    });

    const totalReceivedMoney = Math.round(periodReceivedMoney * 100) / 100;
    const allTimeTotal = Math.round(allTimeReceivedMoney * 100) / 100;

    return {
      totalReceivedMoney,
      allTimeReceivedMoney: allTimeTotal,
      periodReceivedMoney: totalReceivedMoney,
      paymentCount: payments.length,
      periodPaymentCount: periodPayments.length,
      breakdown: {
        oneTimeProjectsReceived: Math.round(periodOneTime * 100) / 100,
        recurringServicesReceived: Math.round(periodRecurring * 100) / 100,
        refundsDeducted: Math.round(periodRefunds * 100) / 100,
        allTimeOneTimeProjectsReceived: Math.round(allTimeOneTime * 100) / 100,
        allTimeRecurringServicesReceived: Math.round(allTimeRecurring * 100) / 100,
        allTimeRefundsDeducted: Math.round(allTimeRefunds * 100) / 100,
      },
      filterApplied: {
        preset: filters?.dateRange || 'all',
        startDate: filters?.startDate || filters?.dateFrom,
        endDate: filters?.endDate || filters?.dateTo,
      },
    };
  }

  /**
   * Finance KPI summary for Admin Dashboard
   * Total Received Money & Total Collected are derived strictly from verified Payment records
   */
  static async getFinanceSummary(query?: {
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const receivedData = await FinanceService.calculateReceivedMoney(query);

    const [invoices, recentPayments, activeClients] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          isCancelled: false,
          paymentStatus: { notIn: [PaymentStatus.CANCELLED, PaymentStatus.VOID] },
        },
        select: {
          invoiceAmount: true,
          amountPaid: true,
          remainingBalance: true,
          paymentStatus: true,
          isCancelled: true,
          dueDate: true,
          createdAt: true,
          client: { select: { billingCycle: true } },
        },
      }),
      prisma.payment.findMany({
        where: {
          isVoided: false,
          invoice: {
            isCancelled: false,
            paymentStatus: { notIn: [PaymentStatus.CANCELLED, PaymentStatus.VOID] },
          },
        },
        orderBy: { paymentDate: 'desc' },
        take: 10,
        include: {
          client: { select: { companyName: true } },
          invoice: { select: { invoiceNumber: true } },
          receivedBy: { select: { fullName: true } },
        },
      }),
      prisma.client.findMany({
        where: { isArchived: false, status: { in: ['ACTIVE', 'ONBOARDING'] } },
        select: {
          packagePricing: true,
          billingCycle: true,
          status: true,
        },
      }),
    ]);

    let totalInvoiced = 0;
    let pendingBalance = 0;
    let overdueBalance = 0;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let monthlyInvoiced = 0;
    let monthlyRecurringRevenue = 0;
    let monthlyOneTimeRevenue = 0;

    invoices.forEach((inv) => {
      if (inv.isCancelled || inv.paymentStatus === PaymentStatus.CANCELLED || inv.paymentStatus === PaymentStatus.VOID) {
        return;
      }

      const amount = Number(inv.invoiceAmount);
      const balance = Number(inv.remainingBalance);

      totalInvoiced += amount;
      pendingBalance += balance;

      if (inv.paymentStatus === PaymentStatus.OVERDUE || (balance > 0 && inv.dueDate < now)) {
        overdueBalance += balance;
      }

      if (inv.createdAt >= startOfMonth) {
        monthlyInvoiced += amount;
        if (inv.client?.billingCycle === 'ONE_TIME') {
          monthlyOneTimeRevenue += amount;
        } else {
          monthlyRecurringRevenue += amount;
        }
      }
    });

    // Normalize MRR from active recurring contracts (never include ONE_TIME or setup fees in MRR)
    let mrr = 0;
    let oneTimeProjectContractValue = 0;

    activeClients.forEach((c) => {
      const price = Number(c.packagePricing || 0);
      if (c.billingCycle === 'MONTHLY') {
        if (c.status === 'ACTIVE') mrr += price;
      } else if (c.billingCycle === 'QUARTERLY') {
        if (c.status === 'ACTIVE') mrr += Math.round(price / 3);
      } else if (c.billingCycle === 'YEARLY') {
        if (c.status === 'ACTIVE') mrr += Math.round(price / 12);
      } else if (c.billingCycle === 'ONE_TIME') {
        oneTimeProjectContractValue += price;
      }
    });

    return {
      monthlyInvoicedRevenue: monthlyInvoiced,
      monthlyRecurringRevenue: mrr > 0 ? mrr : monthlyRecurringRevenue,
      mrr: mrr > 0 ? mrr : monthlyRecurringRevenue,
      oneTimeProjectContractValue,
      monthlyOneTimeRevenue,
      totalInvoiced,
      totalCollected: receivedData.totalReceivedMoney,
      totalReceivedMoney: receivedData.totalReceivedMoney,
      allTimeReceivedMoney: receivedData.allTimeReceivedMoney,
      receivedPaymentsCount: receivedData.periodPaymentCount,
      allTimePaymentsCount: receivedData.paymentCount,
      receivedMoneyBreakdown: receivedData.breakdown,
      filterApplied: receivedData.filterApplied,
      pendingPaymentsBalance: pendingBalance,
      overduePaymentsBalance: overdueBalance,
      recentPayments,
    };
  }
}

