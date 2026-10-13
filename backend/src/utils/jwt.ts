import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'EMPLOYEE';
  sessionId?: string;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, ENV.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, ENV.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, ENV.JWT_ACCESS_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, ENV.JWT_REFRESH_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

