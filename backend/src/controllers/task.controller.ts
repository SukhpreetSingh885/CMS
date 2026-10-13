import { Request, Response, NextFunction } from 'express';
import { TaskService } from '../services/task.service.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';

export class TaskController {
  static async listTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await TaskService.listTasks(req.query as any);
      return sendPaginated(
        res,
        result.tasks,
        { total: result.total, page: result.page, pageSize: result.pageSize },
        'Tasks listed successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  static async getMyTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await TaskService.listTasks({
        ...req.query,
        assignedToId: req.user!.id,
      } as any);
      return sendPaginated(
        res,
        result.tasks,
        { total: result.total, page: result.page, pageSize: result.pageSize },
        'My tasks'
      );
    } catch (error) {
      next(error);
    }
  }

  static async getTaskById(req: Request, res: Response, next: NextFunction) {
    try {
      const task = await TaskService.getTaskById(req.params.id, req.user);
      return sendSuccess(res, task, 'Task details');
    } catch (error) {
      next(error);
    }
  }

  static async createTask(req: Request, res: Response, next: NextFunction) {
    try {
      const task = await TaskService.createTask(req.body, req.user!.id, {
        ipAddress: req.ip,
      });
      return sendSuccess(res, task, 'Task created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateTask(req: Request, res: Response, next: NextFunction) {
    try {
      const task = await TaskService.updateTask(req.params.id, req.body, req.user!.id, {
        ipAddress: req.ip,
      });
      return sendSuccess(res, task, 'Task updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async deleteTask(req: Request, res: Response, next: NextFunction) {
    try {
      const confirmation = req.body?.confirmation || (req.query?.confirmation as string);
      const result = await TaskService.deleteTask(req.params.id, req.user!.id, {
        ipAddress: req.ip,
        confirmation,
      });
      return sendSuccess(res, result, 'Task deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async startTask(req: Request, res: Response, next: NextFunction) {
    try {
      const task = await TaskService.startTask(req.params.id, req.user!.id, {
        ipAddress: req.ip,
      });
      return sendSuccess(res, task, 'Task started successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updateTaskStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const task = await TaskService.updateTaskStatus(
        req.params.id,
        req.body,
        req.user!.id,
        { ipAddress: req.ip }
      );
      return sendSuccess(res, task, 'Task status updated');
    } catch (error) {
      next(error);
    }
  }

  static async approveTaskDeliverables(req: Request, res: Response, next: NextFunction) {
    try {
      const task = await TaskService.approveTaskDeliverables(
        req.params.id,
        req.body,
        req.user!.id,
        { ipAddress: req.ip }
      );
      return sendSuccess(res, task, 'Task deliverable approved and package progress updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async rejectTask(req: Request, res: Response, next: NextFunction) {
    try {
      const task = await TaskService.rejectTask(
        req.params.id,
        req.body,
        req.user!.id,
        { ipAddress: req.ip }
      );
      return sendSuccess(res, task, 'Task returned to employee for revision');
    } catch (error) {
      next(error);
    }
  }

  static async getTaskDeliverableReview(req: Request, res: Response, next: NextFunction) {
    try {
      const reviewContext = await TaskService.getTaskDeliverableReviewContext(
        req.params.id,
        req.user
      );
      return sendSuccess(res, reviewContext, 'Task deliverable review context');
    } catch (error) {
      next(error);
    }
  }


  static async addComment(req: Request, res: Response, next: NextFunction) {
    try {
      const comment = await TaskService.addComment(
        req.params.id,
        req.user!.id,
        req.body.content,
        req.body.isInternal
      );
      return sendSuccess(res, comment, 'Comment added successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async addAttachment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }
      const fileUrl = `/uploads/${req.file.filename}`;
      const attachment = await TaskService.addAttachment(req.params.id, req.user!.id, {
        fileName: req.file.originalname,
        fileUrl,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
      });
      return sendSuccess(res, attachment, 'Attachment uploaded successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async listAttachments(req: Request, res: Response, next: NextFunction) {
    try {
      const attachments = await TaskService.getTaskAttachments(req.params.id, req.user);
      return sendSuccess(res, attachments, 'Task attachments');
    } catch (error) {
      next(error);
    }
  }

  static async viewAttachment(req: Request, res: Response, next: NextFunction) {
    try {
      const { attachment, filePath } = await TaskService.getTaskAttachmentForAccess(
        req.params.id,
        req.params.attachmentId,
        req.user
      );
      if (attachment.fileType) {
        res.setHeader('Content-Type', attachment.fileType);
      }
      const safeName = attachment.fileName.replace(/["\r\n]/g, '_');
      res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
      return res.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  }

  static async downloadAttachment(req: Request, res: Response, next: NextFunction) {
    try {
      const { attachment, filePath } = await TaskService.getTaskAttachmentForAccess(
        req.params.id,
        req.params.attachmentId,
        req.user
      );
      if (attachment.fileType) {
        res.setHeader('Content-Type', attachment.fileType);
      }
      return res.download(filePath, attachment.fileName);
    } catch (error) {
      next(error);
    }
  }
}

