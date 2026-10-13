import { z } from 'zod';

export const createContentItemSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  title: z.string().min(2, 'Title is required'),
  platform: z
    .enum(['INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'LINKEDIN', 'TWITTER', 'TIKTOK', 'WEBSITE', 'OTHER'])
    .default('INSTAGRAM'),
  contentType: z.enum(['REEL', 'POST', 'STORY', 'CAROUSEL', 'VIDEO', 'BLOG', 'BANNER']).default('REEL'),
  assignedEmployeeId: z.string().optional().nullable(),
  stage: z
    .enum([
      'IDEA',
      'SCRIPT',
      'SHOOT',
      'EDITING',
      'INTERNAL_REVIEW',
      'CLIENT_APPROVAL',
      'SCHEDULED',
      'PUBLISHED',
    ])
    .default('IDEA'),
  shootDate: z.string().optional().nullable(),
  editingDate: z.string().optional().nullable(),
  approvalDate: z.string().optional().nullable(),
  publishingDate: z.string().optional().nullable(),
  caption: z.string().optional().nullable(),
  script: z.string().optional().nullable(),
  attachmentUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateContentItemSchema = createContentItemSchema.partial();

