import { Request, Response, NextFunction } from 'express';
import { MeetingService, CommunicationService, FileService } from '../services/meeting.service.js';
import { sendSuccess } from '../utils/response.js';

export class MeetingController {
  static async listMeetings(req: Request, res: Response, next: NextFunction) {
    try {
      const meetings = await MeetingService.listMeetings({
        ...req.query,
        userId: req.user!.role === 'EMPLOYEE' ? req.user!.id : undefined,
      } as any);
      return sendSuccess(res, meetings, 'Meetings retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async createMeeting(req: Request, res: Response, next: NextFunction) {
    try {
      const meeting = await MeetingService.createMeeting(req.body, req.user!.id);
      return sendSuccess(res, meeting, 'Meeting scheduled successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // Communication logs
  static async listCommunications(req: Request, res: Response, next: NextFunction) {
    try {
      const logs = await CommunicationService.listLogs(req.query as any, req.user);
      return sendSuccess(res, logs, 'Communication logs retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async createCommunication(req: Request, res: Response, next: NextFunction) {
    try {
      const log = await CommunicationService.createLog(req.body, req.user!.id);
      return sendSuccess(res, log, 'Communication log added', 201);
    } catch (error) {
      next(error);
    }
  }

  // File management
  static async listFiles(req: Request, res: Response, next: NextFunction) {
    try {
      const files = await FileService.listFiles(req.query as any, req.user);
      return sendSuccess(res, files, 'Files retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async uploadFile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file provided' });
      }
      const fileUrl = `/uploads/${req.file.filename}`;
      const savedFile = await FileService.createFile(
        {
          clientId: req.body.clientId,
          fileName: req.file.originalname,
          fileUrl,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
          folder: req.body.folder,
          tags: req.body.tags,
        },
        req.user!.id
      );
      return sendSuccess(res, savedFile, 'File uploaded successfully', 201);
    } catch (error) {
      next(error);
    }
  }
}

