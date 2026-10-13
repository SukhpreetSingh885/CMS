import { Router } from 'express';
import { MeetingController } from '../controllers/meeting.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/role.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import { createMeetingSchema } from '../validators/meeting.validator.js';
import { createCommunicationSchema } from '../validators/meeting.validator.js';

const router = Router();

// Meetings
router.get('/meetings', authenticate, MeetingController.listMeetings);
router.post('/meetings', authenticate, requireAdmin, validateRequest({ body: createMeetingSchema }), MeetingController.createMeeting);

// Communications
router.get('/communications', authenticate, MeetingController.listCommunications);
router.post('/communications', authenticate, validateRequest({ body: createCommunicationSchema }), MeetingController.createCommunication);

// Files
router.get('/files', authenticate, MeetingController.listFiles);
router.post('/files', authenticate, upload.single('file'), MeetingController.uploadFile);

export default router;

