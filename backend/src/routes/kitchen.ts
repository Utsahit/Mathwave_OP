import { Router } from 'express';
import { kitchenController } from '../controllers/kitchen.controller';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { branchScopeMiddleware } from '../middleware/branch-context';
import {
  updateTicketPrioritySchema,
  assignStationSchema,
} from '../validators/kitchen.validator';

const router = Router();

router.get(
  '/tickets',
  requireAuth(),
  requirePermission('kitchen:view'),
  branchScopeMiddleware,
  kitchenController.listTickets
);

router.get(
  '/tickets/:id',
  requireAuth(),
  requirePermission('kitchen:view'),
  kitchenController.getTicket
);

router.put(
  '/tickets/:id/start',
  requireAuth(),
  requirePermission('kitchen:update'),
  kitchenController.startTicket
);

router.put(
  '/tickets/:id/complete',
  requireAuth(),
  requirePermission('kitchen:update'),
  kitchenController.completeTicket
);

router.put(
  '/tickets/:id/priority',
  requireAuth(),
  requirePermission('kitchen:update'),
  validate({ body: updateTicketPrioritySchema }),
  kitchenController.updatePriority
);

router.put(
  '/tickets/:id/assign',
  requireAuth(),
  requirePermission('kitchen:assign'),
  validate({ body: assignStationSchema }),
  kitchenController.assignStation
);

export default router;
