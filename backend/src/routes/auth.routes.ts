import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { authLimiter } from '../middlewares/rateLimit.middleware.js';
import { loginSchema, updateProfileSchema } from '../validators/auth.validator.js';

const router = Router();

router.post('/login', authLimiter, validateRequest({ body: loginSchema }), AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', authenticate, AuthController.logout);
router.get('/me', authenticate, AuthController.me);
router.patch('/profile', authenticate, validateRequest({ body: updateProfileSchema }), AuthController.updateProfile);

export default router;

