import { Router } from 'express';
import { TaskController } from '../controllers/task.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/role.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  addTaskCommentSchema,
  approveTaskDeliverablesSchema,
  rejectTaskSchema,
} from '../validators/task.validator.js';

const router = Router();

router.use(authenticate);

router.get('/my', TaskController.getMyTasks);
router.get('/', TaskController.listTasks);
router.get('/:id', TaskController.getTaskById);
router.get('/:id/deliverable-review', TaskController.getTaskDeliverableReview);

// Task deliverable review, approval and rejection
router.post(
  '/:id/approve-deliverable',
  validateRequest({ body: approveTaskDeliverablesSchema }),
  TaskController.approveTaskDeliverables
);
router.post(
  '/:id/reject',
  validateRequest({ body: rejectTaskSchema }),
  TaskController.rejectTask
);

// Task creation and management (Admins only)
router.post('/', requireAdmin, validateRequest({ body: createTaskSchema }), TaskController.createTask);
router.patch('/:id', requireAdmin, validateRequest({ body: updateTaskSchema }), TaskController.updateTask);
router.delete('/:id', requireAdmin, TaskController.deleteTask);

// Start task (assigned Employee or self-assigned Admin)
router.post('/:id/start', TaskController.startTask);
router.patch('/:id/start', TaskController.startTask);

// Status update (both Admin and Employee assigned can update status)
router.patch('/:id/status', validateRequest({ body: updateTaskStatusSchema }), TaskController.updateTaskStatus);


// Comments and Attachments
router.post('/:id/comments', validateRequest({ body: addTaskCommentSchema }), TaskController.addComment);
router.get('/:id/attachments', TaskController.listAttachments);
router.post('/:id/attachments', upload.single('file'), TaskController.addAttachment);
router.get('/:id/attachments/:attachmentId/view', TaskController.viewAttachment);
router.get('/:id/attachments/:attachmentId/download', TaskController.downloadAttachment);

export default router;

