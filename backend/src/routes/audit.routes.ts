import { Router } from 'express';
import { AuditController } from '../controllers/audit.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/role.middleware.js';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/', AuditController.listLogs);

export default router;

