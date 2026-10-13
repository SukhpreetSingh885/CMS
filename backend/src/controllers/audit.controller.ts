import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/audit.service.js';
import { sendPaginated } from '../utils/response.js';

export class AuditController {
  static async listLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuditService.getLogs(req.query as any);
      return sendPaginated(
        res,
        result.items,
        { total: result.total, page: result.page, pageSize: result.pageSize },
        'Audit logs retrieved'
      );
    } catch (error) {
      next(error);
    }
  }
}

