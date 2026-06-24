import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { mobileService } from '../services/mobile.service';
import { sendSuccess } from '../utils/response';

export class MobileController {
  getDashboard = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await mobileService.getDashboard(req.user!.userId);
      sendSuccess(res, 'Mobile dashboard retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getProfile = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const profile = await mobileService.getProfile(req.user!.userId);
      sendSuccess(res, 'Profile retrieved successfully.', profile);
    } catch (err) {
      next(err);
    }
  };

  getOrders = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await mobileService.getOrders(req.user!.userId, page, limit);
      sendSuccess(res, 'Orders retrieved successfully.', result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  };

  getReservations = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await mobileService.getReservations(req.user!.userId, page, limit);
      sendSuccess(res, 'Reservations retrieved successfully.', result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const mobileController = new MobileController();
