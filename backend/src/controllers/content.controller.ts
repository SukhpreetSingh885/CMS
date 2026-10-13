import { Request, Response, NextFunction } from 'express';
import { ContentService } from '../services/content.service.js';
import { ApprovalService } from '../services/approval.service.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';

export class ContentController {
  static async listContent(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ContentService.listContent(req.query as any);
      return sendPaginated(
        res,
        result.items,
        { total: result.total, page: result.page, pageSize: result.pageSize },
        'Content items listed'
      );
    } catch (error) {
      next(error);
    }
  }

  static async getContentById(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await ContentService.getContentById(req.params.id);
      return sendSuccess(res, item, 'Content details');
    } catch (error) {
      next(error);
    }
  }

  static async createContent(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await ContentService.createContent(req.body, req.user!.id, {
        ipAddress: req.ip,
      });
      return sendSuccess(res, item, 'Content item created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateContent(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await ContentService.updateContent(req.params.id, req.body, req.user!.id, {
        ipAddress: req.ip,
      });
      return sendSuccess(res, item, 'Content item updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export class ApprovalController {
  static async getPendingApprovals(req: Request, res: Response, next: NextFunction) {
    try {
      const approvals = await ApprovalService.getPendingApprovals(req.query as any);
      return sendSuccess(res, approvals, 'Pending approval queue');
    } catch (error) {
      next(error);
    }
  }
}

