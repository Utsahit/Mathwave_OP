import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import { securityController } from '../controllers/security.controller';

const router = Router();

router.get(
  '/dashboard',
  requireAuth(),
  requirePermission('security:view'),
  securityController.getDashboard
);

export default router;
