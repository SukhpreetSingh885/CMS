import { Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service.js';
import { AuditService } from '../services/audit.service.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';

export class NotificationController {
  static async listNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await NotificationService.listUserNotifications(req.user!.id);
      return sendSuccess(res, data, 'User notifications');
    } catch (error) {
      next(error);
    }
  }

  static async getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await NotificationService.getUnreadCount(req.user!.id);
      return sendSuccess(res, data, 'Unread count');
    } catch (error) {
      next(error);
    }
  }

  static async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      await NotificationService.markAsRead(req.params.id, req.user!.id);
      return sendSuccess(res, null, 'Notification marked as read');
    } catch (error) {
      next(error);
    }
  }

  static async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      await NotificationService.markAllAsRead(req.user!.id);
      return sendSuccess(res, null, 'All notifications marked as read');
    } catch (error) {
      next(error);
    }
  }
}

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

