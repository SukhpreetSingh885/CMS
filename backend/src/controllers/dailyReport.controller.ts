import { Request, Response, NextFunction } from 'express';
import { DailyReportService } from '../services/dailyReport.service.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';

export class DailyReportController {
  static async listReports(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await DailyReportService.listReports(req.query as any);
      return sendPaginated(
        res,
        result.reports,
        { total: result.total, page: result.page, pageSize: result.pageSize },
        'Daily reports'
      );
    } catch (error) {
      next(error);
    }
  }

  static async getMyReports(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await DailyReportService.listReports({
        ...req.query,
        submittedById: req.user!.id,
      } as any);
      return sendPaginated(
        res,
        result.reports,
        { total: result.total, page: result.page, pageSize: result.pageSize },
        'My submitted reports'
      );
    } catch (error) {
      next(error);
    }
  }

  static async getReportById(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await DailyReportService.getReportById(req.params.id);
      return sendSuccess(res, report, 'Daily report details');
    } catch (error) {
      next(error);
    }
  }

  static async createReport(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await DailyReportService.createReport(req.body, req.user!.id, {
        ipAddress: req.ip,
      });
      return sendSuccess(res, report, 'Daily work report submitted successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateReport(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await DailyReportService.updateReport(
        req.params.id,
        req.body,
        req.user!.id,
        req.user!.role,
        { ipAddress: req.ip }
      );
      return sendSuccess(res, report, 'Daily work report updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async submitDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await DailyReportService.submitDraft(req.params.id, req.user!.id, {
        ipAddress: req.ip,
      });
      return sendSuccess(res, report, 'Report submitted for review');
    } catch (error) {
      next(error);
    }
  }

  static async reviewReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, reviewerComments } = req.body;
      const report = await DailyReportService.reviewReport(
        req.params.id,
        status,
        reviewerComments,
        req.user!.id,
        { ipAddress: req.ip }
      );
      return sendSuccess(res, report, `Report marked as ${status}`);
    } catch (error) {
      next(error);
    }
  }
}

