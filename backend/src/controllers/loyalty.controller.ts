import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { loyaltyService } from '../services/loyalty.service';
import { sendSuccess } from '../utils/response';

export class LoyaltyController {
  getBalance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.userId;
      const balance = await loyaltyService.getBalance(userId);
      sendSuccess(res, 'Loyalty balance retrieved.', { balance });
    } catch (err) {
      next(err);
    }
  };

  getHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const history = await loyaltyService.getHistory(userId, page, limit);
      sendSuccess(res, 'Loyalty history retrieved.', history);
    } catch (err) {
      next(err);
    }
  };

  redeemPoints = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.userId;
      const { points, orderId } = req.body;
      const result = await loyaltyService.redeemPoints(userId, points, orderId);
      sendSuccess(res, 'Points redeemed successfully.', result);
    } catch (err) {
      next(err);
    }
  };

  adjustPoints = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const adminUserId = authReq.user!.userId;
      const { userId, points, description } = req.body;
      const result = await loyaltyService.adjustPoints(
        userId,
        points,
        description,
        adminUserId
      );
      sendSuccess(res, 'Points adjusted successfully.', result);
    } catch (err) {
      next(err);
    }
  };
}

export const loyaltyController = new LoyaltyController();
