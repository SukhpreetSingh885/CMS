import { Request, Response, NextFunction } from 'express';
import { DailyReportService } from '../services/dailyReport.service.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';
import { AppError, NotFoundError } from '../utils/AppError.js';
import { prisma } from '../config/db.js';
import path from 'path';
import fs from 'fs';

export class DailyReportController {
  static async listReports(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await DailyReportService.listReports(req.query as any);
      return sendPaginated(
        res,
        result.reports,
        { total: result.total, page: result.page, pageSize: result.pageSize },
        'Client work reports'
      );
    } catch (error) {
      next(error);
    }
  }

  static async getMyReports(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await DailyReportService.listReports({
        ...req.query,
        submittedById: req.user!.id,
      } as any);
      return sendPaginated(
        res,
        result.reports,
        { total: result.total, page: result.page, pageSize: result.pageSize },
        'My client reports'
      );
    } catch (error) {
      next(error);
    }
  }

  static async getReportById(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await DailyReportService.getReportById(req.params.id);
      return sendSuccess(res, report, 'Client work report details');
    } catch (error) {
      next(error);
    }
  }

  static async createReport(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await DailyReportService.createReport(req.body, req.user!.id, {
        ipAddress: req.ip,
      });
      return sendSuccess(res, report, 'Client work report submitted successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateReport(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await DailyReportService.updateReport(
        req.params.id,
        req.body,
        req.user!.id,
        req.user!.role,
        { ipAddress: req.ip }
      );
      return sendSuccess(res, report, 'Client work report updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async submitDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await DailyReportService.submitDraft(req.params.id, req.user!.id, {
        ipAddress: req.ip,
      });
      return sendSuccess(res, report, 'Client report submitted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async reviewReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, reviewerComments } = req.body;
      const report = await DailyReportService.reviewReport(
        req.params.id,
        status,
        reviewerComments,
        req.user!.id,
        { ipAddress: req.ip }
      );
      return sendSuccess(res, report, `Report feedback saved`);
    } catch (error) {
      next(error);
    }
  }

  static async addAttachment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new AppError('No attachment file provided', 400);
      }
      const fileUrl = `/uploads/${req.file.filename}`;
      const attachment = await DailyReportService.addAttachment(
        req.params.id,
        {
          fileName: req.file.originalname,
          fileUrl,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
        },
        req.user!.id,
        req.user!.role
      );
      return sendSuccess(res, attachment, 'Attachment uploaded successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async downloadAttachment(req: Request, res: Response, next: NextFunction) {
    try {
      const attachment = await prisma.dailyReportAttachment.findUnique({
        where: { id: req.params.attachmentId },
        include: { report: true },
      });
      if (!attachment) {
        throw new NotFoundError('Attachment not found');
      }

      // Authorization: employee who submitted, or admin
      if (req.user!.role !== 'ADMIN' && attachment.report.submittedById !== req.user!.id) {
        // Also allow if user is assigned to client
        const isClientAssigned = await prisma.clientAssignedEmployee.findUnique({
          where: { clientId_userId: { clientId: attachment.report.clientId, userId: req.user!.id } },
        });
        if (!isClientAssigned) {
          throw new AppError('Forbidden: Access denied to attachment', 403);
        }
      }

      const storedFilename = path.basename(attachment.fileUrl);
      const uploadsDir = path.resolve(process.cwd(), 'uploads');
      const filePath = path.resolve(uploadsDir, storedFilename);

      if (!filePath.startsWith(uploadsDir) || !fs.existsSync(filePath)) {
        throw new NotFoundError('Attachment file not found on disk');
      }

      res.setHeader('Content-Disposition', `attachment; filename="${attachment.fileName}"`);
      if (attachment.fileType) {
        res.setHeader('Content-Type', attachment.fileType);
      }
      return res.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  }
}
