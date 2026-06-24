import { Router } from 'express';
import { loyaltyController } from '../controllers/loyalty.controller';
import { validate } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import {
  redeemPointsSchema,
  adjustPointsSchema,
  loyaltyHistoryQuerySchema,
} from '../validators/loyalty.validator';

const router = Router();

router.get('/balance', requireAuth(), loyaltyController.getBalance);
router.get(
  '/history',
  requireAuth(),
  validate(loyaltyHistoryQuerySchema),
  loyaltyController.getHistory
);
router.post(
  '/redeem',
  requireAuth(),
  validate(redeemPointsSchema),
  loyaltyController.redeemPoints
);
router.post(
  '/adjust',
  requireAuth(),
  requirePermission('loyalty:update'),
  validate(adjustPointsSchema),
  loyaltyController.adjustPoints
);

export default router;
