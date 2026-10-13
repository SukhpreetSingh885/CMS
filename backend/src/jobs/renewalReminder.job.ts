import { prisma } from '../config/db.js';
import { RenewalStatus } from '@prisma/client';
import { logger } from '../utils/logger.js';

export class BackgroundJobs {
  /**
   * Run renewal reminder check for 30-day and 7-day deadlines
   */
  static async checkRenewalReminders() {
    try {
      const now = new Date();
      const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Find all upcoming renewals
      const upcomingRenewals = await prisma.renewal.findMany({
        where: {
          renewalStatus: RenewalStatus.UPCOMING,
          renewalDate: { lte: in30Days },
        },
        include: {
          client: {
            include: { assignedAdmin: true },
          },
        },
      });

      for (const ren of upcomingRenewals) {
        const diffDays = Math.ceil(
          (ren.renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffDays <= 7 && !ren.reminderSent7d) {
          if (ren.client.assignedAdminId) {
            await prisma.notification.create({
              data: {
                userId: ren.client.assignedAdminId,
                title: 'CRITICAL: Renewal in 7 Days',
                message: `Client ${ren.client.companyName} contract renewal is due in ${diffDays} day(s)!`,
                type: 'RENEWAL',
                link: '/admin/renewals',
              },
            });
          }
          await prisma.renewal.update({
            where: { id: ren.id },
            data: { reminderSent7d: true, renewalStatus: RenewalStatus.DUE },
          });
        } else if (diffDays <= 30 && !ren.reminderSent30d) {
          if (ren.client.assignedAdminId) {
            await prisma.notification.create({
              data: {
                userId: ren.client.assignedAdminId,
                title: 'Upcoming Client Renewal (30 Days)',
                message: `Client ${ren.client.companyName} renewal is approaching on ${ren.renewalDate.toISOString().slice(0, 10)}.`,
                type: 'RENEWAL',
                link: '/admin/renewals',
              },
            });
          }
          await prisma.renewal.update({
            where: { id: ren.id },
            data: { reminderSent30d: true },
          });
        }
      }
    } catch (error) {
      logger.error('Error running renewal reminders job', error);
    }
  }
}

