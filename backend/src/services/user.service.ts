import { Prisma, Role, UserStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { MAX_ADMIN_LIMIT } from '../config/constants.js';
import { hashPassword } from '../utils/password.js';
import { AppError, ConflictError, ForbiddenError, BadRequestError, NotFoundError } from '../utils/AppError.js';
import { AuditService } from './audit.service.js';

export interface CreateAdminDto {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  department?: string;
  designation?: string;
}

export interface CreateEmployeeDto {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  employeeId: string;
  department: string;
  designation: string;
  joiningDate?: string;
}

export class UserService {
  /**
   * Get current count of Admin accounts (Single Admin system: exactly 1 allowed)
   */
  static async getAdminCount() {
    const totalAdmins = await prisma.user.count({
      where: { role: Role.ADMIN },
    });

    const activeAdmins = await prisma.user.count({
      where: { role: Role.ADMIN, status: UserStatus.ACTIVE },
    });

    return {
      total: totalAdmins,
      active: activeAdmins,
      max: MAX_ADMIN_LIMIT,
      remaining: Math.max(0, MAX_ADMIN_LIMIT - totalAdmins),
      isLimitReached: totalAdmins >= MAX_ADMIN_LIMIT,
    };
  }

  /**
   * Create Admin account: Strictly prohibited in Single Admin System once 1 Admin exists
   */
  static async createAdmin(dto: CreateAdminDto, creatorId: string, meta?: { ipAddress?: string }) {
    // Enforce atomic serialized transaction to prevent concurrent race conditions
    return await prisma.$transaction(
      async (tx) => {
        const currentAdminCount = await tx.user.count({
          where: { role: Role.ADMIN },
        });

        if (currentAdminCount >= MAX_ADMIN_LIMIT) {
          throw new ConflictError(
            'Single Admin System: Only one Admin account is permitted in the system. Additional Admin accounts cannot be created.'
          );
        }

        const existingEmail = await tx.user.findUnique({
          where: { email: dto.email.toLowerCase() },
        });

        if (existingEmail) {
          throw new ConflictError('An account with this email address already exists.');
        }

        const hashedPassword = await hashPassword(dto.password);

        const admin = await tx.user.create({
          data: {
            email: dto.email.toLowerCase(),
            password: hashedPassword,
            fullName: dto.fullName,
            role: Role.ADMIN,
            phone: dto.phone,
            department: dto.department || 'Executive Management',
            designation: dto.designation || 'Master Administrator',
            status: UserStatus.ACTIVE,
            createdById: creatorId,
          },
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            phone: true,
            department: true,
            designation: true,
            status: true,
            createdAt: true,
          },
        });

        const creator = await tx.user.findUnique({ where: { id: creatorId } });

        await AuditService.log({
          actorId: creatorId,
          actorName: creator?.fullName,
          actorEmail: creator?.email,
          action: 'ADMIN_CREATED',
          resourceType: 'USER',
          resourceId: admin.id,
          afterState: admin,
          ipAddress: meta?.ipAddress,
        });

        return admin;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );
  }

  /**
   * Create a new Employee account
   */
  static async createEmployee(dto: CreateEmployeeDto, creatorId: string, meta?: { ipAddress?: string }) {
    const existingEmail = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existingEmail) {
      throw new ConflictError('An account with this email address already exists.');
    }

    const existingEmpId = await prisma.user.findUnique({
      where: { employeeId: dto.employeeId },
    });
    if (existingEmpId) {
      throw new ConflictError('Employee ID is already assigned to another user.');
    }

    const hashedPassword = await hashPassword(dto.password);

    const employee = await prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        password: hashedPassword,
        fullName: dto.fullName,
        role: Role.EMPLOYEE,
        phone: dto.phone,
        employeeId: dto.employeeId,
        department: dto.department,
        designation: dto.designation,
        joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : new Date(),
        status: UserStatus.ACTIVE,
        createdById: creatorId,
      },
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
        createdAt: true,
      },
    });

    const creator = await prisma.user.findUnique({ where: { id: creatorId } });

    await AuditService.log({
      actorId: creatorId,
      actorName: creator?.fullName,
      actorEmail: creator?.email,
      action: 'EMPLOYEE_CREATED',
      resourceType: 'USER',
      resourceId: employee.id,
      afterState: employee,
      ipAddress: meta?.ipAddress,
    });

    return employee;
  }

  /**
   * List users with search, role, status, department, designation, joining date filters, and sorting
   */
  static async listUsers(query: {
    role?: Role;
    status?: UserStatus;
    department?: string;
    designation?: string;
    joiningDateFrom?: string;
    joiningDateTo?: string;
    clientId?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10));
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {};

    if (query.role) {
      where.role = query.role;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.department) {
      where.department = { contains: query.department };
    }
    if (query.designation) {
      where.designation = { contains: query.designation };
    }
    if (query.clientId) {
      where.clientAssignments = {
        some: {
          clientId: query.clientId,
        },
      };
    }

    if (query.joiningDateFrom || query.joiningDateTo) {
      where.joiningDate = {};
      if (query.joiningDateFrom) {
        where.joiningDate.gte = new Date(query.joiningDateFrom);
      }
      if (query.joiningDateTo) {
        const to = new Date(query.joiningDateTo);
        to.setHours(23, 59, 59, 999);
        where.joiningDate.lte = to;
      }
    }

    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search } },
        { email: { contains: query.search } },
        { employeeId: { contains: query.search } },
        { designation: { contains: query.search } },
        { department: { contains: query.search } },
      ];
    }

    // Dynamic sorting
    const validSortFields = ['fullName', 'email', 'employeeId', 'department', 'designation', 'joiningDate', 'createdAt', 'status'];
    const sortBy = query.sortBy && validSortFields.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder: Prisma.SortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.UserOrderByWithRelationInput = { [sortBy]: sortOrder };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
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
          _count: {
            select: {
              tasksAssigned: true,
              clientAssignments: true,
              dailyReportsSubmitted: true,
            },
          },
        },
      }),
    ]);

    return { total, page, pageSize, users };
  }

  /**
   * Get user by ID with detailed profile and statistics
   */
  static async getUserById(userId: string) {
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
        updatedAt: true,
        createdById: true,
        clientAssignments: {
          include: {
            client: {
              select: { id: true, companyName: true, status: true },
            },
          },
        },
        _count: {
          select: {
            tasksAssigned: true,
            dailyReportsSubmitted: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  /**
   * Update user details (Prevents role modification to/from Admin)
   */
  static async updateUser(
    userId: string,
    data: {
      fullName?: string;
      phone?: string | null;
      department?: string | null;
      designation?: string | null;
      employeeId?: string | null;
      joiningDate?: string | null;
      password?: string;
      role?: Role;
    },
    actorId: string,
    meta?: { ipAddress?: string }
  ) {
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      throw new NotFoundError('User not found');
    }

    if (data.role && data.role !== targetUser.role) {
      throw new ForbiddenError(
        'Role modifications to or from Admin are not permitted. Viralstan CMS operates under a Single-Admin architecture.'
      );
    }

    const updateData: any = {};
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.department !== undefined) updateData.department = data.department;
    if (data.designation !== undefined) updateData.designation = data.designation;
    if (data.employeeId !== undefined && data.employeeId !== targetUser.employeeId) {
      const existing = await prisma.user.findUnique({ where: { employeeId: data.employeeId || '' } });
      if (existing && existing.id !== userId) {
        throw new ConflictError('Employee ID is already in use by another user');
      }
      updateData.employeeId = data.employeeId;
    }
    if (data.joiningDate !== undefined) {
      updateData.joiningDate = data.joiningDate ? new Date(data.joiningDate) : null;
    }
    if (data.password) {
      updateData.password = await hashPassword(data.password);
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
        updatedAt: true,
      },
    });

    const actor = await prisma.user.findUnique({ where: { id: actorId } });
    await AuditService.log({
      actorId,
      actorName: actor?.fullName,
      actorEmail: actor?.email,
      action: 'USER_UPDATED',
      resourceType: 'USER',
      resourceId: userId,
      beforeState: targetUser,
      afterState: updated,
      ipAddress: meta?.ipAddress,
    });

    return updated;
  }

  /**
   * Update user status (ACTIVE / DISABLED) with Single Admin safety rules:
   * 1. The master Admin account can NEVER be disabled or deactivated.
   * 2. Employees can be disabled/reactivated by the Admin.
   * 3. Invalidate active sessions upon disabling.
   */
  static async updateUserStatus(
    userId: string,
    newStatus: UserStatus,
    actorId: string,
    reason?: string,
    meta?: { ipAddress?: string }
  ) {
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      throw new NotFoundError('User not found');
    }

    if (targetUser.role === Role.ADMIN) {
      throw new BadRequestError('The master Admin account cannot be disabled or deactivated.');
    }

    if (targetUser.status === newStatus) {
      return targetUser;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { status: newStatus },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          updatedAt: true,
        },
      });

      if (newStatus === UserStatus.DISABLED) {
        await tx.session.updateMany({
          where: { userId, revoked: false },
          data: { revoked: true },
        });
      }

      return user;
    });

    const actor = await prisma.user.findUnique({ where: { id: actorId } });
    await AuditService.log({
      actorId,
      actorName: actor?.fullName,
      actorEmail: actor?.email,
      action: newStatus === UserStatus.DISABLED ? 'USER_DISABLED' : 'USER_REACTIVATED',
      resourceType: 'USER',
      resourceId: userId,
      beforeState: { status: targetUser.status, reason },
      afterState: { status: updated.status },
      ipAddress: meta?.ipAddress,
    });

    return updated;
  }
}
