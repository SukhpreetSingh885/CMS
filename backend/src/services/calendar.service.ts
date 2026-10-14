import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { buildPrismaDateFilter } from '../utils/dateRange.js';

export type CalendarEventType = 'TASK' | 'CONTENT' | 'MEETING' | 'RENEWAL';

export interface CalendarEventColor {
  bg: string;
  text: string;
  border: string;
  badge: string;
  dot: string;
  primaryHex: string;
}

export interface CalendarParticipant {
  id: string;
  name: string;
  email?: string;
  designation?: string | null;
  avatarUrl?: string | null;
}

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  description?: string | null;
  start: string; // ISO 8601
  end: string;   // ISO 8601
  isAllDay: boolean;
  status: string;
  priority?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  assignedToId?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  assignedToAvatar?: string | null;
  participants?: CalendarParticipant[];
  meetingLink?: string | null;
  platform?: string | null;
  contentType?: string | null;
  amount?: number | null;
  sourceUrl?: string;
  color: CalendarEventColor;
  meta?: Record<string, any>;
}

export interface CalendarQueryDto {
  startDate?: string;
  endDate?: string;
  dateRange?: string;
  clientId?: string;
  employeeId?: string;
  type?: 'ALL' | 'TASK' | 'CONTENT' | 'MEETING' | 'RENEWAL' | string;
  search?: string;
}

const COLOR_MAP: Record<CalendarEventType, CalendarEventColor> = {
  TASK: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800',
    dot: 'bg-emerald-500',
    primaryHex: '#10B981',
  },
  CONTENT: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-800',
    dot: 'bg-purple-500',
    primaryHex: '#8B5CF6',
  },
  MEETING: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-800',
    dot: 'bg-blue-500',
    primaryHex: '#3B82F6',
  },
  RENEWAL: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-800',
    dot: 'bg-amber-500',
    primaryHex: '#F59E0B',
  },
};

export class CalendarService {
  static async getEvents(
    query: CalendarQueryDto,
    user: { id: string; role: 'ADMIN' | 'EMPLOYEE' }
  ) {
    const isEmployee = user.role === 'EMPLOYEE';
    const effectiveEmployeeId = isEmployee ? user.id : query.employeeId;

    // Parse date boundary
    const boundary = buildPrismaDateFilter({
      dateRange: query.dateRange,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    let dateFilter: { gte?: Date; lte?: Date } | undefined = boundary;
    if (!dateFilter && (query.startDate || query.endDate)) {
      dateFilter = {};
      if (query.startDate) dateFilter.gte = new Date(query.startDate);
      if (query.endDate) dateFilter.lte = new Date(query.endDate);
    }

    const typeFilter = (query.type || 'ALL').toUpperCase();
    const shouldFetchTasks = typeFilter === 'ALL' || typeFilter === 'TASK';
    const shouldFetchContent = typeFilter === 'ALL' || typeFilter === 'CONTENT';
    const shouldFetchMeetings = typeFilter === 'ALL' || typeFilter === 'MEETING';
    // Renewals are strictly ADMIN only and not filtered by employeeId
    const shouldFetchRenewals = !isEmployee && !query.employeeId && (typeFilter === 'ALL' || typeFilter === 'RENEWAL');

    const searchTrimmed = query.search?.trim();

    // 1. Fetch Tasks
    let taskEvents: CalendarEvent[] = [];
    if (shouldFetchTasks) {
      const taskWhere: Prisma.TaskWhereInput = {};
      if (dateFilter) {
        taskWhere.dueDate = dateFilter;
      }
      if (query.clientId) {
        taskWhere.clientId = query.clientId;
      }
      if (effectiveEmployeeId) {
        taskWhere.assignedToId = effectiveEmployeeId;
      }
      if (searchTrimmed) {
        taskWhere.OR = [
          { title: { contains: searchTrimmed } },
          { description: { contains: searchTrimmed } },
          { client: { companyName: { contains: searchTrimmed } } },
        ];
      }

      const tasks = await prisma.task.findMany({
        where: taskWhere,
        orderBy: { dueDate: 'asc' },
        include: {
          client: { select: { id: true, companyName: true, email: true } },
          assignedTo: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
          service: { select: { id: true, name: true } },
        },
      });

      taskEvents = tasks.map((t) => ({
        id: t.id,
        type: 'TASK' as CalendarEventType,
        title: t.title,
        description: t.description,
        start: t.dueDate.toISOString(),
        end: t.dueDate.toISOString(),
        isAllDay: true,
        status: t.status,
        priority: t.priority,
        clientId: t.clientId,
        clientName: t.client?.companyName,
        clientEmail: t.client?.email,
        assignedToId: t.assignedToId,
        assignedToName: t.assignedTo?.fullName,
        assignedToEmail: t.assignedTo?.email,
        assignedToAvatar: t.assignedTo?.avatarUrl,
        sourceUrl: isEmployee ? '/employee/my-tasks' : '/admin/tasks',
        color: COLOR_MAP.TASK,
        meta: {
          serviceName: t.service?.name,
          completionPercentage: t.completionPercentage,
          estimatedHours: t.estimatedHours ? Number(t.estimatedHours) : 0,
        },
      }));
    }

    // 2. Fetch Content Items
    let contentEvents: CalendarEvent[] = [];
    if (shouldFetchContent) {
      const contentWhere: Prisma.ContentItemWhereInput = {};
      if (dateFilter) {
        contentWhere.OR = [
          { publishingDate: dateFilter },
          { AND: [{ publishingDate: null }, { shootDate: dateFilter }] },
        ];
      }
      if (query.clientId) {
        contentWhere.clientId = query.clientId;
      }

      if (isEmployee) {
        contentWhere.AND = [
          ...(contentWhere.AND ? (Array.isArray(contentWhere.AND) ? contentWhere.AND : [contentWhere.AND]) : []),
          {
            OR: [
              { assignedEmployeeId: user.id },
              { client: { assignedEmployees: { some: { userId: user.id } } } },
              {
                client: {
                  services: {
                    some: {
                      assignedEmployees: {
                        some: { employeeId: user.id, isActive: true },
                      },
                    },
                  },
                },
              },
            ],
          },
        ];
      } else if (query.employeeId) {
        contentWhere.assignedEmployeeId = query.employeeId;
      }

      if (searchTrimmed) {
        const searchCondition = {
          OR: [
            { title: { contains: searchTrimmed } },
            { caption: { contains: searchTrimmed } },
            { notes: { contains: searchTrimmed } },
            { client: { companyName: { contains: searchTrimmed } } },
          ],
        };
        contentWhere.AND = [
          ...(contentWhere.AND ? (Array.isArray(contentWhere.AND) ? contentWhere.AND : [contentWhere.AND]) : []),
          searchCondition,
        ];
      }

      const contentItems = await prisma.contentItem.findMany({
        where: contentWhere,
        orderBy: [{ publishingDate: 'asc' }, { shootDate: 'asc' }],
        include: {
          client: { select: { id: true, companyName: true, email: true } },
          assignedEmployee: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        },
      });

      contentEvents = contentItems.map((c) => {
        const eventDate = c.publishingDate || c.shootDate || c.createdAt;
        const dateIso = eventDate.toISOString();
        return {
          id: c.id,
          type: 'CONTENT' as CalendarEventType,
          title: c.title,
          description: c.caption || c.notes || c.script,
          start: dateIso,
          end: dateIso,
          isAllDay: false,
          status: c.stage,
          platform: c.platform,
          contentType: c.contentType,
          clientId: c.clientId,
          clientName: c.client?.companyName,
          clientEmail: c.client?.email,
          assignedToId: c.assignedEmployeeId,
          assignedToName: c.assignedEmployee?.fullName,
          assignedToEmail: c.assignedEmployee?.email,
          assignedToAvatar: c.assignedEmployee?.avatarUrl,
          sourceUrl: isEmployee ? '/employee/calendar' : '/admin/calendar',
          color: COLOR_MAP.CONTENT,
          meta: {
            stage: c.stage,
            platform: c.platform,
            contentType: c.contentType,
            shootDate: c.shootDate?.toISOString(),
            editingDate: c.editingDate?.toISOString(),
            approvalDate: c.approvalDate?.toISOString(),
            publishingDate: c.publishingDate?.toISOString(),
            attachmentUrl: c.attachmentUrl,
          },
        };
      });
    }

    // 3. Fetch Meetings
    let meetingEvents: CalendarEvent[] = [];
    if (shouldFetchMeetings) {
      const meetingWhere: Prisma.MeetingWhereInput = {};
      if (dateFilter) {
        meetingWhere.meetingDateTime = dateFilter;
      }
      if (query.clientId) {
        meetingWhere.clientId = query.clientId;
      }

      if (effectiveEmployeeId) {
        meetingWhere.OR = [
          { createdById: effectiveEmployeeId },
          { participants: { some: { userId: effectiveEmployeeId } } },
        ];
      }

      if (searchTrimmed) {
        const searchCondition = {
          OR: [
            { title: { contains: searchTrimmed } },
            { agenda: { contains: searchTrimmed } },
            { client: { companyName: { contains: searchTrimmed } } },
          ],
        };
        meetingWhere.AND = [
          ...(meetingWhere.AND ? (Array.isArray(meetingWhere.AND) ? meetingWhere.AND : [meetingWhere.AND]) : []),
          searchCondition,
        ];
      }

      const meetings = await prisma.meeting.findMany({
        where: meetingWhere,
        orderBy: { meetingDateTime: 'asc' },
        include: {
          client: { select: { id: true, companyName: true, email: true } },
          createdBy: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
          participants: {
            include: {
              user: { select: { id: true, fullName: true, email: true, designation: true, avatarUrl: true } },
            },
          },
        },
      });

      meetingEvents = meetings.map((m) => {
        const startTime = m.meetingDateTime;
        // Default meeting duration: 45 minutes
        const endTime = new Date(startTime.getTime() + 45 * 60 * 1000);
        return {
          id: m.id,
          type: 'MEETING' as CalendarEventType,
          title: m.title,
          description: m.agenda || m.notes || m.actionItems,
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          isAllDay: false,
          status: 'SCHEDULED',
          meetingLink: m.meetingLink,
          clientId: m.clientId,
          clientName: m.client?.companyName,
          clientEmail: m.client?.email,
          assignedToId: m.createdById,
          assignedToName: m.createdBy?.fullName,
          assignedToEmail: m.createdBy?.email,
          assignedToAvatar: m.createdBy?.avatarUrl,
          participants: m.participants.map((p) => ({
            id: p.user.id,
            name: p.user.fullName,
            email: p.user.email,
            designation: p.user.designation,
            avatarUrl: p.user.avatarUrl,
          })),
          sourceUrl: isEmployee ? '/employee/calendar' : '/admin/meetings',
          color: COLOR_MAP.MEETING,
          meta: {
            agenda: m.agenda,
            notes: m.notes,
            actionItems: m.actionItems,
            followUpDate: m.followUpDate?.toISOString(),
          },
        };
      });
    }

    // 4. Fetch Renewals (Admin only)
    let renewalEvents: CalendarEvent[] = [];
    if (shouldFetchRenewals) {
      const renewalWhere: Prisma.RenewalWhereInput = {};
      if (dateFilter) {
        renewalWhere.renewalDate = dateFilter;
      }
      if (query.clientId) {
        renewalWhere.clientId = query.clientId;
      }
      if (searchTrimmed) {
        renewalWhere.client = {
          companyName: { contains: searchTrimmed },
        };
      }

      const renewals = await prisma.renewal.findMany({
        where: renewalWhere,
        orderBy: { renewalDate: 'asc' },
        include: {
          client: { select: { id: true, companyName: true, email: true } },
        },
      });

      renewalEvents = renewals.map((r) => ({
        id: r.id,
        type: 'RENEWAL' as CalendarEventType,
        title: `Renewal: ${r.client?.companyName || 'Client'}`,
        description: `Contract renewal due for ${r.client?.companyName}. Amount: ₹${Number(r.renewalAmount).toLocaleString('en-IN')}`,
        start: r.renewalDate.toISOString(),
        end: r.renewalDate.toISOString(),
        isAllDay: true,
        status: r.renewalStatus,
        amount: Number(r.renewalAmount),
        clientId: r.clientId,
        clientName: r.client?.companyName,
        clientEmail: r.client?.email,
        sourceUrl: '/admin/renewals',
        color: COLOR_MAP.RENEWAL,
        meta: {
          renewalAmount: Number(r.renewalAmount),
          renewalStatus: r.renewalStatus,
          contractStartDate: r.contractStartDate.toISOString(),
          contractEndDate: r.contractEndDate.toISOString(),
        },
      }));
    }

    // Combine and sort chronologically
    const allEvents = [...taskEvents, ...contentEvents, ...meetingEvents, ...renewalEvents].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );

    return {
      events: allEvents,
      stats: {
        total: allEvents.length,
        tasks: taskEvents.length,
        content: contentEvents.length,
        meetings: meetingEvents.length,
        renewals: renewalEvents.length,
      },
    };
  }
}

