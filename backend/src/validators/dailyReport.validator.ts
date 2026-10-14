import { z } from 'zod';

export const createDailyReportSchema = z.object({
  reportDate: z.string().optional(),
  clientId: z.string().min(1, 'Client is required'),
  taskId: z.string().optional().nullable(),
  serviceId: z.string().optional().nullable(),
  workCompleted: z.string().min(3, 'Work completed summary is required'),
  workDescription: z.string().optional().nullable(),
  quantity: z.number().min(0, 'Quantity cannot be negative').optional().nullable(),
  unit: z.string().max(100).optional().nullable(),
  hoursSpent: z.number().min(0, 'Hours spent cannot be negative').optional().nullable(),
  workPending: z.string().optional().nullable(),
  issuesOrBlockers: z.string().optional().nullable(),
  nextAction: z.string().optional().nullable(),
  isDraft: z.boolean().default(false),
});

export const updateDailyReportSchema = createDailyReportSchema.partial();

export const reviewDailyReportSchema = z.object({
  status: z.enum(['APPROVED', 'REVISION_REQUESTED', 'UNDER_REVIEW'], {
    errorMap: () => ({ message: 'Status must be APPROVED, REVISION_REQUESTED, or UNDER_REVIEW' }),
  }),
  reviewerComments: z.string().min(2, 'Reviewer comments are required'),
});

