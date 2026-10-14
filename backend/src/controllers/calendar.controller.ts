import { Request, Response, NextFunction } from 'express';
import { CalendarService } from '../services/calendar.service.js';
import { sendSuccess } from '../utils/response.js';

export class CalendarController {
  static async getEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await CalendarService.getEvents(req.query as any, req.user!);
      return sendSuccess(res, result, 'Calendar events retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

