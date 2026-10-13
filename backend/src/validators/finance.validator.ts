import { z } from 'zod';

export const createInvoiceSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  invoiceDate: z.string().optional(),
  dueDate: z.string().min(1, 'Due date is required'),
  packageValue: z.number().nonnegative().default(0),
  invoiceAmount: z.number().positive('Invoice amount must be greater than 0'),
  notes: z.string().optional().nullable(),
});

export const updateInvoiceSchema = z.object({
  dueDate: z.string().optional(),
  notes: z.string().optional().nullable(),
  invoiceAmount: z.number().positive().optional(),
});

export const recordPaymentSchema = z
  .object({
    invoiceId: z.string().min(1, 'Invoice is required'),
    amount: z.number().positive('Payment amount must be greater than 0'),
    paymentDate: z.string().optional(),
    paymentMethod: z
      .enum(['BANK_TRANSFER', 'UPI', 'CREDIT_CARD', 'CASH', 'CHEQUE', 'OTHER'])
      .default('BANK_TRANSFER'),
    transactionReference: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      const electronicMethods = ['BANK_TRANSFER', 'UPI', 'CREDIT_CARD', 'CHEQUE'];
      if (electronicMethods.includes(data.paymentMethod)) {
        return typeof data.transactionReference === 'string' && data.transactionReference.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Transaction reference (UTR / IMPS / Cheque #) is mandatory for this payment method',
      path: ['transactionReference'],
    }
  );

export const updateRenewalSchema = z.object({
  contractStartDate: z.string().optional(),
  contractEndDate: z.string().optional(),
  renewalDate: z.string().optional(),
  renewalAmount: z.number().nonnegative().optional(),
  renewalStatus: z.enum(['UPCOMING', 'DUE', 'RENEWED', 'CHURNED']).optional(),
  notes: z.string().optional().nullable(),
});

export const voidPaymentSchema = z.object({
  voidReason: z.string().min(3, 'A void reason of at least 3 characters is required'),
});

export const deleteInvoiceSchema = z.object({
  confirmation: z.literal('DELETE', {
    errorMap: () => ({ message: 'You must type DELETE to confirm invoice deletion' }),
  }),
  cleanTestPayments: z.boolean().optional().default(false),
  reason: z.string().optional(),
});

export const cancelInvoiceSchema = z.object({
  cancelReason: z.string().min(5, 'A cancellation reason of at least 5 characters is required'),
});

