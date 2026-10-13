import { Router } from 'express';
import { ContentController, ApprovalController } from '../controllers/content.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/role.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { createContentItemSchema, updateContentItemSchema } from '../validators/content.validator.js';

const router = Router();

// Content pipeline
router.get('/content', authenticate, ContentController.listContent);
router.get('/content/:id', authenticate, ContentController.getContentById);
router.post('/content', authenticate, requireAdmin, validateRequest({ body: createContentItemSchema }), ContentController.createContent);
router.patch('/content/:id', authenticate, validateRequest({ body: updateContentItemSchema }), ContentController.updateContent);

// Centralized approvals (Admin only)
router.get('/approvals', authenticate, requireAdmin, ApprovalController.getPendingApprovals);

export default router;

