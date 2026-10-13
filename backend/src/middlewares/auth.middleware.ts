import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt.js';
import { prisma } from '../config/db.js';
import { UnauthorizedError, ForbiddenError } from '../utils/AppError.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: 'ADMIN' | 'EMPLOYEE';
        fullName: string;
        status: 'ACTIVE' | 'DISABLED';
      };
      tokenPayload?: TokenPayload;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    let token = req.cookies?.access_token;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new UnauthorizedError('Authentication required. Please log in.');
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      throw new UnauthorizedError('Invalid or expired session. Please log in again.');
    }

    // Check user in database and verify active status
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User account not found.');
    }

    if (user.status === 'DISABLED') {
      throw new ForbiddenError('Account is disabled. Access denied.');
    }

    req.user = user;
    req.tokenPayload = payload;
    next();
  } catch (error) {
    next(error);
  }
}

