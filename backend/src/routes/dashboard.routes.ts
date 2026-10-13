import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/role.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/admin', requireAdmin, DashboardController.getAdminDashboard);
router.get('/employee', DashboardController.getEmployeeDashboard);
router.get('/analytics', requireAdmin, DashboardController.getAnalyticsInsights);

export default router;

