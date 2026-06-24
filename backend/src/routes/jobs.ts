import { Router } from 'express';
import { jobsController } from '../controllers/jobs.controller';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth(), requirePermission('job:view'), jobsController.list);
router.get(
  '/stats',
  requireAuth(),
  requirePermission('job:view'),
  jobsController.getStats
);
router.post(
  '/:id/retry',
  requireAuth(),
  requirePermission('job:retry'),
  jobsController.retry
);

export default router;
