import { Router } from 'express';
import { referralController } from '../controllers/referral.controller';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import {
  createReferralSchema,
  referralQuerySchema,
} from '../validators/referral.validator';

const router = Router();

router.get(
  '/',
  requireAuth(),
  validate(referralQuerySchema),
  referralController.listReferrals
);
router.post(
  '/',
  requireAuth(),
  validate(createReferralSchema),
  referralController.createReferral
);
router.post('/:id/grant-bonus', requireAuth(), referralController.grantBonus);

export default router;
