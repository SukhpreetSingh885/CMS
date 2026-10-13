import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
      startTime?: number;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.header('X-Request-Id');
  const requestId = existingId || `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  req.id = requestId;
  req.startTime = Date.now();
  res.setHeader('X-Request-Id', requestId);
  res.locals.requestId = requestId;

  next();
}

