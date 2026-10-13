import { Request, Response, NextFunction } from 'express';
import { FinanceService } from '../services/finance.service.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';

export class FinanceController {
  static async listInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await FinanceService.listInvoices(req.query as any);
      return sendPaginated(
        res,
        result.invoices,
        { total: result.total, page: result.page, pageSize: result.pageSize },
        'Invoices listed successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  static async getInvoiceById(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await FinanceService.getInvoiceById(req.params.id);
      return sendSuccess(res, invoice, 'Invoice details');
    } catch (error) {
      next(error);
    }
  }

  static async createInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await FinanceService.createInvoice(req.body, req.user!.id, {
        ipAddress: req.ip,
      });
      return sendSuccess(res, invoice, 'Invoice created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async recordPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await FinanceService.recordPayment(req.body, req.user!.id, {
        ipAddress: req.ip,
      });
      return sendSuccess(res, result, 'Payment recorded successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async listPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await FinanceService.listPayments(req.query as any);
      return sendPaginated(
        res,
        result.payments,
        { total: result.total, page: result.page, pageSize: result.pageSize },
        'Payments listed successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  static async voidPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await FinanceService.voidPayment(
        req.params.id,
        req.body.voidReason,
        req.user!.id,
        { ipAddress: req.ip }
      );
      return sendSuccess(res, result, 'Payment voided successfully');
    } catch (error) {
      next(error);
    }
  }

  static async listRenewals(req: Request, res: Response, next: NextFunction) {
    try {
      const renewals = await FinanceService.listRenewals(req.query as any);
      return sendSuccess(res, renewals, 'Renewals retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async updateRenewal(req: Request, res: Response, next: NextFunction) {
    try {
      const renewal = await FinanceService.updateRenewal(req.params.id, req.body);
      return sendSuccess(res, renewal, 'Renewal updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getFinanceSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await FinanceService.getFinanceSummary(req.query as any);
      return sendSuccess(res, summary, 'Finance summary');
    } catch (error) {
      next(error);
    }
  }

  static async downloadInvoicePdf(req: Request, res: Response, next: NextFunction) {
    try {
      const inline = req.query.inline === 'true' || req.query.view === 'true';
      await FinanceService.downloadInvoicePdf(req.params.id, res, inline);
    } catch (error) {
      next(error);
    }
  }

  static async deleteInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await FinanceService.deleteInvoice(
        req.params.id,
        req.body.confirmation,
        req.user!.id,
        {
          cleanTestPayments: Boolean(req.body.cleanTestPayments),
          reason: req.body.reason,
        },
        { ipAddress: req.ip }
      );
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async cancelInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await FinanceService.cancelInvoice(
        req.params.id,
        { cancelReason: req.body.cancelReason },
        req.user!.id,
        { ipAddress: req.ip }
      );
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }
}

