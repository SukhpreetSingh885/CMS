import { Router } from 'express';
import { CalendarController } from '../controllers/calendar.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Unified calendar events endpoint for both Admin and Employee
router.get('/events', authenticate, CalendarController.getEvents);

export default router;

