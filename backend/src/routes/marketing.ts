import { Router } from 'express';
import { marketingController } from '../controllers/marketing.controller';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();

router.get(
  '/automations',
  requireAuth(),
  requirePermission('marketing:view'),
  marketingController.listAutomations
);
router.post(
  '/automations',
  requireAuth(),
  requirePermission('marketing:update'),
  marketingController.createAutomation
);
router.put(
  '/automations/:id',
  requireAuth(),
  requirePermission('marketing:update'),
  marketingController.updateAutomation
);

export default router;
