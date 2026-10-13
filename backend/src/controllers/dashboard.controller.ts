import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboard.service.js';
import { sendSuccess } from '../utils/response.js';

export class DashboardController {
  static async getAdminDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await DashboardService.getAdminDashboard(req.query as any);
      return sendSuccess(res, data, 'Admin dashboard metrics');
    } catch (error) {
      next(error);
    }
  }

  static async getEmployeeDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await DashboardService.getEmployeeDashboard(req.user!.id);
      return sendSuccess(res, data, 'Employee dashboard metrics');
    } catch (error) {
      next(error);
    }
  }

  static async getAnalyticsInsights(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await DashboardService.getAnalyticsInsights();
      return sendSuccess(res, data, 'Analytics insights');
    } catch (error) {
      next(error);
    }
  }
}

