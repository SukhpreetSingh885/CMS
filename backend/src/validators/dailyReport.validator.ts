import { z } from 'zod';

export const createDailyReportSchema = z.object({
  reportDate: z.string().optional(),
  clientId: z.string().min(1, 'Client is required'),
  taskId: z.string().optional().nullable(),
  serviceId: z.string().optional().nullable(),
  workDescription: z.string().min(5, 'Work description is required'),
  workCompleted: z.string().min(5, 'Work completed summary is required'),
  workPending: z.string().optional().nullable(),
  hoursSpent: z.number().positive('Hours spent must be greater than 0'),
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

