import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { referralService } from '../services/referral.service';
import { sendSuccess } from '../utils/response';

export class ReferralController {
  createReferral = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const referrerUserId = authReq.user!.userId;
      const { referredUserId } = req.body;
      const referral = await referralService.createReferral(
        referrerUserId,
        referredUserId
      );
      sendSuccess(res, 'Referral created successfully.', referral, {}, 201);
    } catch (err) {
      next(err);
    }
  };

  grantBonus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await referralService.grantBonus(id);
      sendSuccess(res, 'Referral bonus granted successfully.');
    } catch (err) {
      next(err);
    }
  };

  listReferrals = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await referralService.listReferrals(userId, page, limit);
      sendSuccess(res, 'Referrals retrieved.', result);
    } catch (err) {
      next(err);
    }
  };
}

export const referralController = new ReferralController();
