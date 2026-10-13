import { Router } from 'express';
import { FinanceController } from '../controllers/finance.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/role.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import {
  createInvoiceSchema,
  deleteInvoiceSchema,
  cancelInvoiceSchema,
  recordPaymentSchema,
  updateRenewalSchema,
  voidPaymentSchema,
} from '../validators/finance.validator.js';

const router = Router();

// Finance module is strictly for Admins - protect specific endpoints
router.get('/summary', authenticate, requireAdmin, FinanceController.getFinanceSummary);

// Invoices
router.get('/invoices', authenticate, requireAdmin, FinanceController.listInvoices);
router.get('/invoices/:id', authenticate, requireAdmin, FinanceController.getInvoiceById);
router.get('/invoices/:id/pdf', authenticate, requireAdmin, FinanceController.downloadInvoicePdf);
router.post('/invoices', authenticate, requireAdmin, validateRequest({ body: createInvoiceSchema }), FinanceController.createInvoice);
router.delete('/invoices/:id', authenticate, requireAdmin, validateRequest({ body: deleteInvoiceSchema }), FinanceController.deleteInvoice);
router.post('/invoices/:id/void', authenticate, requireAdmin, validateRequest({ body: cancelInvoiceSchema }), FinanceController.cancelInvoice);
router.post('/invoices/:id/cancel', authenticate, requireAdmin, validateRequest({ body: cancelInvoiceSchema }), FinanceController.cancelInvoice);

// Payments
router.get('/payments', authenticate, requireAdmin, FinanceController.listPayments);
router.post('/payments', authenticate, requireAdmin, validateRequest({ body: recordPaymentSchema }), FinanceController.recordPayment);
router.post('/payments/:id/void', authenticate, requireAdmin, validateRequest({ body: voidPaymentSchema }), FinanceController.voidPayment);

// Renewals
router.get('/renewals', authenticate, requireAdmin, FinanceController.listRenewals);
router.patch('/renewals/:id', authenticate, requireAdmin, validateRequest({ body: updateRenewalSchema }), FinanceController.updateRenewal);

export default router;

