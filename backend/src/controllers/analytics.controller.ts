import { Request, Response, NextFunction } from 'express';
import { analyticsService } from '../services/analytics.service';
import { branchAnalyticsService } from '../services/branch-analytics.service';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth';

export class AnalyticsController {
  getDashboard = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await analyticsService.getDashboard();
      sendSuccess(res, 'Dashboard analytics retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getOrderAnalytics = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await analyticsService.getOrderAnalytics();
      sendSuccess(res, 'Order analytics retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getRevenueAnalytics = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await analyticsService.getRevenueAnalytics();
      sendSuccess(res, 'Revenue analytics retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getInventoryAnalytics = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await analyticsService.getInventoryAnalytics();
      sendSuccess(res, 'Inventory analytics retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getLoyaltyAnalytics = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await analyticsService.getLoyaltyAnalytics();
      sendSuccess(res, 'Loyalty analytics retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getBranchOverview = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const branchScope = authReq.user ? req.branchScope : undefined;
      const data = await branchAnalyticsService.getAllBranchesOverview(branchScope);
      sendSuccess(res, 'Branch overview analytics retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getFavoritesAnalytics = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await analyticsService.getFavoritesAnalytics();
      sendSuccess(res, 'Favorites analytics retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getCustomerRetention = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await analyticsService.getCustomerRetention();
      sendSuccess(res, 'Customer retention analytics retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getTopCustomerSegments = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await analyticsService.getTopCustomerSegments();
      sendSuccess(res, 'Customer segments retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getSupportTicketMetrics = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await analyticsService.getSupportTicketMetrics();
      sendSuccess(res, 'Support ticket metrics retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getMarketingAnalytics = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await analyticsService.getMarketingAnalytics();
      sendSuccess(res, 'Marketing analytics retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };
}

export const analyticsController = new AnalyticsController();
