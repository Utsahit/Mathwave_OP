import { Router } from 'express';
import { giftCardController } from '../controllers/giftcard.controller';
import { validate } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import {
  createGiftCardSchema,
  updateGiftCardSchema,
  redeemGiftCardSchema,
  giftCardQuerySchema,
} from '../validators/giftcard.validator';

const router = Router();

router.get(
  '/',
  requireAuth(),
  requirePermission('giftcard:view'),
  validate(giftCardQuerySchema),
  giftCardController.listGiftCards
);
router.post(
  '/',
  requireAuth(),
  requirePermission('giftcard:create'),
  validate(createGiftCardSchema),
  giftCardController.createGiftCard
);
router.put(
  '/:id',
  requireAuth(),
  requirePermission('giftcard:update'),
  validate(updateGiftCardSchema),
  giftCardController.updateGiftCard
);
router.post(
  '/redeem',
  requireAuth(),
  validate(redeemGiftCardSchema),
  giftCardController.redeemGiftCard
);
router.patch(
  '/:id/deactivate',
  requireAuth(),
  requirePermission('giftcard:update'),
  giftCardController.deactivateGiftCard
);

export default router;
