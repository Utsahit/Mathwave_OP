import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { giftCardService } from '../services/giftcard.service';
import { sendSuccess } from '../utils/response';

export class GiftCardController {
  createGiftCard = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const adminUserId = authReq.user!.userId;
      const giftCard = await giftCardService.createGiftCard(req.body, adminUserId);
      sendSuccess(res, 'Gift card created successfully.', giftCard, {}, 201);
    } catch (err) {
      next(err);
    }
  };

  listGiftCards = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await giftCardService.listGiftCards(page, limit);
      sendSuccess(res, 'Gift cards retrieved.', result);
    } catch (err) {
      next(err);
    }
  };

  redeemGiftCard = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { code, orderId, amount } = req.body;
      const result = await giftCardService.redeemGiftCard(code, orderId, amount);
      sendSuccess(res, 'Gift card redeemed successfully.', result);
    } catch (err) {
      next(err);
    }
  };

  deactivateGiftCard = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const adminUserId = authReq.user!.userId;
      const { id } = req.params;
      const result = await giftCardService.deactivateGiftCard(id, adminUserId);
      sendSuccess(res, 'Gift card deactivated.', result);
    } catch (err) {
      next(err);
    }
  };

  updateGiftCard = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const adminUserId = authReq.user!.userId;
      const { id } = req.params;
      const result = await giftCardService.updateGiftCard(id, req.body, adminUserId);
      sendSuccess(res, 'Gift card updated.', result);
    } catch (err) {
      next(err);
    }
  };
}

export const giftCardController = new GiftCardController();
