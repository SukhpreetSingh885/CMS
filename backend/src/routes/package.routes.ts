import { Router } from 'express';
import { PackageController } from '../controllers/package.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/role.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import {
  createPackageSchema,
  updatePackageSchema,
  createServiceSchema,
  updateServiceSchema,
} from '../validators/package.validator.js';

const router = Router();

// Packages (All logged in users can view packages, only Admin can edit)
router.get('/packages', authenticate, PackageController.listPackages);
router.get('/packages/:id', authenticate, PackageController.getPackageById);
router.post('/packages', authenticate, requireAdmin, validateRequest({ body: createPackageSchema }), PackageController.createPackage);
router.put('/packages/:id', authenticate, requireAdmin, validateRequest({ body: updatePackageSchema }), PackageController.updatePackage);
router.patch('/packages/:id', authenticate, requireAdmin, validateRequest({ body: updatePackageSchema }), PackageController.updatePackage);
router.patch('/packages/:id/archive', authenticate, requireAdmin, PackageController.archivePackage);
router.delete('/packages/:id', authenticate, requireAdmin, PackageController.deletePackage);

// Services
router.get('/services', authenticate, PackageController.listServices);
router.get('/services/:id', authenticate, PackageController.getServiceById);
router.post('/services', authenticate, requireAdmin, validateRequest({ body: createServiceSchema }), PackageController.createService);
router.patch('/services/:id', authenticate, requireAdmin, validateRequest({ body: updateServiceSchema }), PackageController.updateService);
router.delete('/services/:id', authenticate, requireAdmin, PackageController.deleteService);

export default router;

