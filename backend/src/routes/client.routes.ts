import { Router } from 'express';
import { ClientController } from '../controllers/client.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/role.middleware.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import {
  createClientSchema,
  updateClientSchema,
  updateClientServiceTeamSchema,
  deleteClientPermanentSchema,
} from '../validators/client.validator.js';

const router = Router();

router.use(authenticate);

// Employees can view their assigned clients
router.get('/my', ClientController.getMyClients);

// Admin-only client management endpoints
router.get('/', requireAdmin, ClientController.listClients);
router.post('/', requireAdmin, validateRequest({ body: createClientSchema }), ClientController.createClient);
router.get('/:id', ClientController.getClientById);
router.patch('/:id', requireAdmin, validateRequest({ body: updateClientSchema }), ClientController.updateClient);
router.put(
  '/:id/services/:clientServiceId/team',
  requireAdmin,
  validateRequest({ body: updateClientServiceTeamSchema }),
  ClientController.updateClientServiceTeam
);
router.patch(
  '/:id/services/:clientServiceId/team',
  requireAdmin,
  validateRequest({ body: updateClientServiceTeamSchema }),
  ClientController.updateClientServiceTeam
);
router.delete('/:id/permanent', requireAdmin, validateRequest({ body: deleteClientPermanentSchema }), ClientController.deleteClientPermanent);
router.delete('/:id', requireAdmin, ClientController.archiveClient);

export default router;

