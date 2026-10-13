import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../utils/AppError.js';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required.'));
  }
  if (req.user.role !== 'ADMIN') {
    return next(new ForbiddenError('Access forbidden: Admin privileges required.'));
  }
  next();
}

export function requireRole(allowedRoles: ('ADMIN' | 'EMPLOYEE')[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required.'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('Access forbidden: Insufficient permissions.'));
    }
    next();
  };
}

