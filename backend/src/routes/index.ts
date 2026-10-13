import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import clientRoutes from './client.routes.js';
import packageRoutes from './package.routes.js';
import taskRoutes from './task.routes.js';
import dailyReportRoutes from './dailyReport.routes.js';
import contentRoutes from './content.routes.js';
import meetingRoutes from './meeting.routes.js';
import financeRoutes from './finance.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import reportRoutes from './report.routes.js';
import notificationRoutes from './notification.routes.js';
import auditRoutes from './audit.routes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/clients', clientRoutes);
apiRouter.use('/', packageRoutes); // /packages, /services
apiRouter.use('/tasks', taskRoutes);
apiRouter.use('/reports', dailyReportRoutes); // /reports/daily, /reports/my
apiRouter.use('/reports', reportRoutes); // /reports/service-performance, /reports/client-delivery, etc.
apiRouter.use('/', contentRoutes); // /content, /approvals
apiRouter.use('/', meetingRoutes); // /meetings, /communications, /files
apiRouter.use('/', financeRoutes); // /invoices, /payments, /renewals, /summary
apiRouter.use('/finance', financeRoutes); // support /finance/invoices, /finance/invoices/:id/pdf
apiRouter.use('/dashboard', dashboardRoutes); // /dashboard/admin, /dashboard/employee
apiRouter.use('/analytics', reportRoutes); // /analytics/client-delivery, export
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/audit-logs', auditRoutes);

export default apiRouter;

