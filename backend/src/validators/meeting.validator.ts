import { z } from 'zod';

export const createMeetingSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  title: z.string().min(2, 'Meeting title is required'),
  meetingDateTime: z.string().min(1, 'Meeting date & time is required'),
  meetingLink: z.string().optional().nullable(),
  agenda: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  actionItems: z.string().optional().nullable(),
  followUpDate: z.string().optional().nullable(),
  participantIds: z.array(z.string()).optional(),
});

export const updateMeetingSchema = createMeetingSchema.partial();

export const createCommunicationSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  type: z.enum(['WHATSAPP', 'EMAIL', 'PHONE', 'MEETING', 'OTHER']).default('PHONE'),
  date: z.string().optional(),
  summary: z.string().min(3, 'Summary is required'),
  clientRequirements: z.string().optional().nullable(),
  nextAction: z.string().optional().nullable(),
  followUpDate: z.string().optional().nullable(),
});

export const updateCommunicationSchema = createCommunicationSchema.partial();

