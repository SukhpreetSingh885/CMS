import { Router } from 'express';
import { ReportController } from '../controllers/report.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/role.middleware.js';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/client-delivery', ReportController.getClientDeliveryReport);
router.get('/employee-work', ReportController.getEmployeeWorkReport);
router.get('/employee-productivity', ReportController.getEmployeeProductivityReport);
router.get('/service-performance', ReportController.getServicePerformanceReport);
router.get('/tasks', ReportController.getTasksReport);
router.get('/revenue', ReportController.getRevenueReport);
router.get('/renewals', ReportController.getRenewalReport);

// Exports
router.get('/export/excel/:reportType', ReportController.exportExcel);
router.get('/export/pdf/:reportType', ReportController.exportPDF);

export default router;

