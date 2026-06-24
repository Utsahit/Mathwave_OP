import { Router } from 'express';
import { couponController } from '../controllers/coupon.controller';
import { validate } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import {
  createCouponSchema,
  updateCouponSchema,
  validateCouponSchema,
  applyCouponSchema,
  couponQuerySchema,
} from '../validators/coupon.validator';

const router = Router();

router.get(
  '/',
  requireAuth(),
  requirePermission('coupon:view'),
  validate(couponQuerySchema),
  couponController.listCoupons
);
router.post(
  '/',
  requireAuth(),
  requirePermission('coupon:create'),
  validate(createCouponSchema),
  couponController.createCoupon
);
router.put(
  '/:id',
  requireAuth(),
  requirePermission('coupon:update'),
  validate(updateCouponSchema),
  couponController.updateCoupon
);
router.delete(
  '/:id',
  requireAuth(),
  requirePermission('coupon:delete'),
  couponController.deleteCoupon
);
router.post(
  '/validate',
  requireAuth(),
  validate(validateCouponSchema),
  couponController.validateCoupon
);
router.post(
  '/apply',
  requireAuth(),
  validate(applyCouponSchema),
  couponController.applyCoupon
);

export default router;
