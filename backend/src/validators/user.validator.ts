import { z } from 'zod';

export const createAdminSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
});

export const createEmployeeSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().optional(),
  employeeId: z.string().min(1, 'Employee ID is required'),
  department: z.string().min(1, 'Department is required'),
  designation: z.string().min(1, 'Designation is required'),
  joiningDate: z.string().optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  employeeId: z.string().optional().nullable(),
  joiningDate: z.string().optional().nullable(),
  password: z.string().min(8).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'DISABLED'], {
    errorMap: () => ({ message: 'Status must be ACTIVE or DISABLED' }),
  }),
  reason: z.string().optional(),
});

