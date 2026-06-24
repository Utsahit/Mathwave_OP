import { Router } from 'express';
import { segmentController } from '../controllers/segment.controller';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();

router.get(
  '/',
  requireAuth(),
  requirePermission('segment:view'),
  segmentController.listSegments
);
router.get(
  '/stats',
  requireAuth(),
  requirePermission('segment:view'),
  segmentController.getSegmentStats
);
router.get('/my', requireAuth(), segmentController.getUserSegments);
router.post(
  '/recalculate',
  requireAuth(),
  requirePermission('segment:update'),
  segmentController.recalculateSegments
);

export default router;
