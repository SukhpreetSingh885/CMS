import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
import { sendSuccess } from '../utils/response.js';

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const meta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
      const result = await AuthService.login(email, password, meta);

      // Set secure HTTP-only cookies
      res.cookie('access_token', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000, // 15 mins
      });

      res.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return sendSuccess(res, result, 'Logged in successfully');
    } catch (error) {
      next(error);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.refresh_token || req.body?.refreshToken;
      const result = await AuthService.refresh(token);

      res.cookie('access_token', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
      });

      res.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return sendSuccess(res, result, 'Token refreshed successfully');
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionId = req.tokenPayload?.sessionId;
      const userId = req.user?.id;
      await AuthService.logout(sessionId, userId);

      res.clearCookie('access_token');
      res.clearCookie('refresh_token');

      return sendSuccess(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  static async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.getCurrentUser(req.user!.id);
      return sendSuccess(res, user, 'Current user profile');
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.updateProfile(req.user!.id, req.body);
      return sendSuccess(res, user, 'Profile updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

