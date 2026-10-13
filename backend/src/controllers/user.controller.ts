import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';

export class UserController {
  static async getAdminCount(req: Request, res: Response, next: NextFunction) {
    try {
      const counts = await UserService.getAdminCount();
      return sendSuccess(res, counts, 'Admin accounts count');
    } catch (error) {
      next(error);
    }
  }

  static async createAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = await UserService.createAdmin(req.body, req.user!.id, {
        ipAddress: req.ip,
      });
      return sendSuccess(res, admin, 'Admin account created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async createEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await UserService.createEmployee(req.body, req.user!.id, {
        ipAddress: req.ip,
      });
      return sendSuccess(res, employee, 'Employee account created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await UserService.listUsers(req.query as any);
      return sendPaginated(
        res,
        result.users,
        { total: result.total, page: result.page, pageSize: result.pageSize },
        'Users listed successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  static async listAdmins(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await UserService.listUsers({ ...req.query, role: 'ADMIN' } as any);
      return sendPaginated(
        res,
        result.users,
        { total: result.total, page: result.page, pageSize: result.pageSize },
        'Admins listed successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  static async listEmployees(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await UserService.listUsers({ ...req.query, role: 'EMPLOYEE' } as any);
      return sendPaginated(
        res,
        result.users,
        { total: result.total, page: result.page, pageSize: result.pageSize },
        'Employees listed successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  static async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await UserService.getUserById(req.params.id);
      return sendSuccess(res, user, 'User details');
    } catch (error) {
      next(error);
    }
  }

  static async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await UserService.updateUser(req.params.id, req.body, req.user!.id, {
        ipAddress: req.ip,
      });
      return sendSuccess(res, updated, 'User updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updateUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, reason } = req.body;
      const updated = await UserService.updateUserStatus(
        req.params.id,
        status,
        req.user!.id,
        reason,
        { ipAddress: req.ip }
      );
      return sendSuccess(res, updated, `Account status changed to ${status}`);
    } catch (error) {
      next(error);
    }
  }
}

