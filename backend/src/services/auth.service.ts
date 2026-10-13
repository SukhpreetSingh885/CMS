import { prisma } from '../config/db.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { AppError } from '../middlewares/error.middleware.js';
import { AuditService } from './audit.service.js';

export class AuthService {
  static async login(
    email: string,
    pass: string,
    meta?: { ipAddress?: string; userAgent?: string }
  ) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    if (user.status === 'DISABLED') {
      throw new AppError('Your account has been disabled. Please contact an Administrator.', 403);
    }

    const isValid = await comparePassword(pass, user.password);
    if (!isValid) {
      throw new AppError('Invalid email or password', 401);
    }

    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const tempSession = await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: '',
        expiresAt,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      },
    });

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: tempSession.id,
    });

    const refreshToken = signRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: tempSession.id,
    });

    await prisma.session.update({
      where: { id: tempSession.id },
      data: { refreshToken },
    });

    await AuditService.log({
      actorId: user.id,
      actorName: user.fullName,
      actorEmail: user.email,
      action: 'USER_LOGIN',
      resourceType: 'AUTH',
      resourceId: user.id,
      ipAddress: meta?.ipAddress,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
        designation: user.designation,
        employeeId: user.employeeId,
        avatarUrl: user.avatarUrl,
        status: user.status,
      },
      accessToken,
      refreshToken,
    };
  }

  static async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new AppError('Refresh token required', 401);
    }

    const payload = verifyRefreshToken(refreshToken);
    if (!payload || !payload.sessionId) {
      throw new AppError('Invalid refresh token', 401);
    }

    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });

    if (!session || session.revoked || session.refreshToken !== refreshToken) {
      throw new AppError('Session expired or invalidated. Please log in again.', 401);
    }

    if (session.expiresAt < new Date()) {
      throw new AppError('Session expired. Please log in again.', 401);
    }

    if (session.user.status === 'DISABLED') {
      throw new AppError('Account is disabled.', 403);
    }

    // Refresh token rotation
    const newAccessToken = signAccessToken({
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role,
      sessionId: session.id,
    });

    const newRefreshToken = signRefreshToken({
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role,
      sessionId: session.id,
    });

    await prisma.session.update({
      where: { id: session.id },
      data: { refreshToken: newRefreshToken },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: session.user.id,
        email: session.user.email,
        fullName: session.user.fullName,
        role: session.user.role,
        department: session.user.department,
        designation: session.user.designation,
        employeeId: session.user.employeeId,
        avatarUrl: session.user.avatarUrl,
        status: session.user.status,
      },
    };
  }

  static async logout(sessionId?: string, userId?: string) {
    if (sessionId) {
      await prisma.session.updateMany({
        where: { id: sessionId },
        data: { revoked: true },
      });
    } else if (userId) {
      await prisma.session.updateMany({
        where: { userId },
        data: { revoked: true },
      });
    }
  }

  static async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        employeeId: true,
        department: true,
        designation: true,
        joiningDate: true,
        status: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  static async updateProfile(
    userId: string,
    data: {
      fullName?: string;
      phone?: string;
      avatarUrl?: string;
      currentPassword?: string;
      newPassword?: string;
    }
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const updateData: any = {};
    if (data.fullName) updateData.fullName = data.fullName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;

    if (data.newPassword) {
      if (!data.currentPassword) {
        throw new AppError('Current password is required to set a new password', 400);
      }
      const isMatch = await comparePassword(data.currentPassword, user.password);
      if (!isMatch) {
        throw new AppError('Incorrect current password', 400);
      }
      updateData.password = await hashPassword(data.newPassword);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        employeeId: true,
        department: true,
        designation: true,
        status: true,
        avatarUrl: true,
      },
    });

    return updated;
  }
}

