import { Router } from 'express';
import { DailyReportController } from '../controllers/dailyReport.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/role.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import {
  createDailyReportSchema,
  updateDailyReportSchema,
  reviewDailyReportSchema,
} from '../validators/dailyReport.validator.js';

const router = Router();

router.use(authenticate);

// Employee/Admin personal reports
router.get('/my', DailyReportController.getMyReports);
router.post('/daily', validateRequest({ body: createDailyReportSchema }), DailyReportController.createReport);
router.patch('/daily/:id', validateRequest({ body: updateDailyReportSchema }), DailyReportController.updateReport);
router.post('/daily/:id/submit', DailyReportController.submitDraft);

// Attachments on reports
router.post('/daily/:id/attachments', upload.single('file'), DailyReportController.addAttachment);
router.get('/daily/:id/attachments/:attachmentId/download', DailyReportController.downloadAttachment);

// Company-wide reports & details
router.get('/daily', DailyReportController.listReports);
router.get('/daily/:id', DailyReportController.getReportById);
router.patch('/daily/:id/review', requireAdmin, validateRequest({ body: reviewDailyReportSchema }), DailyReportController.reviewReport);

// Aliases for /client routes
router.post('/client', validateRequest({ body: createDailyReportSchema }), DailyReportController.createReport);
router.get('/client', DailyReportController.listReports);
router.get('/client/:id', DailyReportController.getReportById);

export default router;
