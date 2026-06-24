import { Router } from 'express';
import { supportTicketController } from '../controllers/support-ticket.controller';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();

router.post('/', requireAuth(), supportTicketController.create);
router.get('/my', requireAuth(), supportTicketController.listMy);
router.get(
  '/admin',
  requireAuth(),
  requirePermission('support:view'),
  supportTicketController.adminList
);
router.put(
  '/admin/:id/status',
  requireAuth(),
  requirePermission('support:update'),
  supportTicketController.updateStatus
);

export default router;
