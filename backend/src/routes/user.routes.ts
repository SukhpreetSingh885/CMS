import { Router } from 'express';
import { UserController } from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/role.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import {
  createEmployeeSchema,
  updateUserSchema,
  updateStatusSchema,
} from '../validators/user.validator.js';

const router = Router();

// All user management routes require Admin privileges
router.use(authenticate, requireAdmin);

router.get('/admins/count', UserController.getAdminCount);
router.get('/admins', UserController.listAdmins);

router.get('/employees', UserController.listEmployees);
router.post('/employees', validateRequest({ body: createEmployeeSchema }), UserController.createEmployee);

router.get('/', UserController.listUsers);
router.get('/:id', UserController.getUserById);
router.patch('/:id', validateRequest({ body: updateUserSchema }), UserController.updateUser);
router.patch('/:id/status', validateRequest({ body: updateStatusSchema }), UserController.updateUserStatus);

export default router;
