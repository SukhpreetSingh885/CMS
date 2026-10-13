import { prisma } from '../config/db.js';
import { CommunicationType, FileFolder } from '@prisma/client';
import { AppError } from '../middlewares/error.middleware.js';
import { buildPrismaDateFilter } from '../utils/dateRange.js';

export class MeetingService {
  static async listMeetings(query: {
    clientId?: string;
    userId?: string;
    dateRange?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = {};
    if (query.clientId) where.clientId = query.clientId;
    if (query.userId) {
      where.OR = [
        { createdById: query.userId },
        { participants: { some: { userId: query.userId } } },
      ];
    }

    const dateFilter = buildPrismaDateFilter({
      dateRange: query.dateRange,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    if (dateFilter) {
      where.meetingDateTime = dateFilter;
    }

    return prisma.meeting.findMany({
      where,
      orderBy: { meetingDateTime: 'asc' },
      include: {
        client: { select: { id: true, companyName: true } },
        createdBy: { select: { id: true, fullName: true, email: true } },
        participants: {
          include: {
            user: { select: { id: true, fullName: true, email: true, designation: true } },
          },
        },
      },
    });
  }

  static async createMeeting(data: {
    clientId: string;
    title: string;
    meetingDateTime: string;
    meetingLink?: string | null;
    agenda?: string | null;
    notes?: string | null;
    actionItems?: string | null;
    followUpDate?: string | null;
    participantIds?: string[];
  }, createdById: string) {
    return prisma.meeting.create({
      data: {
        clientId: data.clientId,
        title: data.title,
        meetingDateTime: new Date(data.meetingDateTime),
        meetingLink: data.meetingLink,
        agenda: data.agenda,
        notes: data.notes,
        actionItems: data.actionItems,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
        createdById,
        participants: data.participantIds
          ? {
              create: data.participantIds.map((userId) => ({ userId })),
            }
          : undefined,
      },
      include: {
        client: true,
        participants: { include: { user: true } },
      },
    });
  }
}

export class CommunicationService {
  static async listLogs(
    query: { clientId?: string; dateRange?: string; startDate?: string; endDate?: string },
    user?: { id: string; role: string }
  ) {
    const where: any = {};
    if (query.clientId) where.clientId = query.clientId;

    if (user && user.role === 'EMPLOYEE') {
      where.client = {
        isArchived: false,
        assignedEmployees: { some: { userId: user.id } },
      };
    }

    const dateFilter = buildPrismaDateFilter({
      dateRange: query.dateRange,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    if (dateFilter) {
      where.date = dateFilter;
    }

    return prisma.communicationLog.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        client: { select: { id: true, companyName: true } },
        loggedBy: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  static async createLog(data: {
    clientId: string;
    type: CommunicationType;
    date?: string;
    summary: string;
    clientRequirements?: string | null;
    nextAction?: string | null;
    followUpDate?: string | null;
  }, loggedById: string) {
    return prisma.communicationLog.create({
      data: {
        clientId: data.clientId,
        loggedById,
        type: data.type,
        date: data.date ? new Date(data.date) : new Date(),
        summary: data.summary,
        clientRequirements: data.clientRequirements,
        nextAction: data.nextAction,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
      },
      include: {
        client: true,
        loggedBy: true,
      },
    });
  }
}

export class FileService {
  static async listFiles(query: { clientId?: string; folder?: FileFolder }, user?: { id: string; role: string }) {
    const where: any = {};
    if (query.clientId) where.clientId = query.clientId;
    if (query.folder) where.folder = query.folder;

    if (user && user.role === 'EMPLOYEE') {
      where.client = {
        isArchived: false,
        assignedEmployees: { some: { userId: user.id } },
      };
    }

    return prisma.clientFile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, companyName: true } },
        uploadedBy: { select: { id: true, fullName: true } },
      },
    });
  }

  static async createFile(data: {
    clientId: string;
    fileName: string;
    fileUrl: string;
    fileType?: string;
    fileSize?: number;
    folder?: FileFolder;
    tags?: string;
  }, uploadedById: string) {
    return prisma.clientFile.create({
      data: {
        clientId: data.clientId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        fileSize: data.fileSize,
        folder: data.folder || 'GENERAL',
        tags: data.tags,
        uploadedById,
      },
    });
  }
}

