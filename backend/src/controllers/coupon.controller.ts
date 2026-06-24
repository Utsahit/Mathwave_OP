import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { couponService } from '../services/coupon.service';
import { sendSuccess } from '../utils/response';

export class CouponController {
  createCoupon = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const adminUserId = authReq.user!.userId;
      const coupon = await couponService.createCoupon(req.body, adminUserId);
      sendSuccess(res, 'Coupon created successfully.', coupon, {}, 201);
    } catch (err) {
      next(err);
    }
  };

  listCoupons = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await couponService.listCoupons(page, limit);
      sendSuccess(res, 'Coupons retrieved.', result);
    } catch (err) {
      next(err);
    }
  };

  updateCoupon = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const adminUserId = authReq.user!.userId;
      const { id } = req.params;
      const coupon = await couponService.updateCoupon(id, req.body, adminUserId);
      sendSuccess(res, 'Coupon updated successfully.', coupon);
    } catch (err) {
      next(err);
    }
  };

  deleteCoupon = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const adminUserId = authReq.user!.userId;
      const { id } = req.params;
      await couponService.deleteCoupon(id, adminUserId);
      sendSuccess(res, 'Coupon deleted successfully.');
    } catch (err) {
      next(err);
    }
  };

  validateCoupon = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { code, orderValue } = req.body;
      const coupon = await couponService.validateCoupon(code, orderValue);
      const discount = couponService.calculateDiscount(coupon, orderValue);
      sendSuccess(res, 'Coupon validated.', { valid: true, discount, coupon });
    } catch (err) {
      next(err);
    }
  };

  applyCoupon = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.userId;
      const { code, orderId, orderValue } = req.body;
      const result = await couponService.applyCoupon(code, orderValue, userId, orderId);
      sendSuccess(res, 'Coupon applied successfully.', result);
    } catch (err) {
      next(err);
    }
  };
}

export const couponController = new CouponController();
