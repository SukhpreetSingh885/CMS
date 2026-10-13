import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(2, 'Task title is required'),
  description: z.string().optional().nullable(),
  clientId: z.string().min(1, 'Client is required'),
  serviceId: z.string().optional().nullable(),
  assignedToId: z.string().min(1, 'Assigned user is required'),
  reviewerId: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().min(1, 'Due date is required'),
  estimatedHours: z.number().nonnegative().optional().default(0),
  deliverableCount: z.number().int().nonnegative().optional().default(0),
  clientApprovalRequired: z.boolean().default(false),
  internalNotes: z.string().optional().nullable(),
  deliverableId: z.string().optional().nullable(),
  deliverableName: z.string().optional().nullable(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  serviceId: z.string().optional().nullable(),
  assignedToId: z.string().optional(),
  reviewerId: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional(),
  estimatedHours: z.number().nonnegative().optional(),
  actualHours: z.number().nonnegative().optional(),
  deliverableCount: z.number().int().nonnegative().optional(),
  deliverableId: z.string().optional().nullable(),
  deliverableName: z.string().optional().nullable(),
  status: z
    .enum([
      'CREATED',
      'ASSIGNED',
      'IN_PROGRESS',
      'INTERNAL_REVIEW',
      'CLIENT_APPROVAL',
      'REVISION_REQUIRED',
      'APPROVED',
      'DELIVERED',
      'COMPLETED',
    ])
    .optional(),
  completionPercentage: z.number().int().min(0).max(100).optional(),
  clientApprovalRequired: z.boolean().optional(),
  internalNotes: z.string().optional().nullable(),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum([
    'CREATED',
    'ASSIGNED',
    'IN_PROGRESS',
    'INTERNAL_REVIEW',
    'CLIENT_APPROVAL',
    'REVISION_REQUIRED',
    'APPROVED',
    'DELIVERED',
    'COMPLETED',
  ]),
  completionPercentage: z.number().int().min(0).max(100).optional(),
  comment: z.string().optional(),
  actualHours: z.number().nonnegative().optional(),
});

export const addTaskCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required'),
  isInternal: z.boolean().default(false),
});

export const approveTaskDeliverablesSchema = z.object({
  approvedQuantity: z.number().int().nonnegative().optional(),
  feedback: z.string().optional(),
  deliverableId: z.string().optional(),
  allowOverCredit: z.boolean().optional().default(false),
});

export const rejectTaskSchema = z.object({
  feedback: z.string().min(1, 'Revision feedback is required'),
});


