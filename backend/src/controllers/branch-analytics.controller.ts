import { Request, Response, NextFunction } from 'express';
import { branchAnalyticsService } from '../services/branch-analytics.service';
import { sendSuccess } from '../utils/response';

export class BranchAnalyticsController {
  getBranchSales = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const result = await branchAnalyticsService.getBranchSales(
        req.params.id,
        startDate,
        endDate
      );
      sendSuccess(res, 'Branch sales analytics retrieved successfully.', result);
    } catch (error) {
      next(error);
    }
  };

  getBranchInventory = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await branchAnalyticsService.getBranchInventory(req.params.id);
      sendSuccess(res, 'Branch inventory analytics retrieved successfully.', result);
    } catch (error) {
      next(error);
    }
  };

  getBranchReservations = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const result = await branchAnalyticsService.getBranchReservations(
        req.params.id,
        startDate,
        endDate
      );
      sendSuccess(res, 'Branch reservation analytics retrieved successfully.', result);
    } catch (error) {
      next(error);
    }
  };

  getBranchLoyalty = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await branchAnalyticsService.getBranchLoyalty(req.params.id);
      sendSuccess(res, 'Branch loyalty analytics retrieved successfully.', result);
    } catch (error) {
      next(error);
    }
  };

  getBranchCustomers = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await branchAnalyticsService.getBranchCustomers(req.params.id);
      sendSuccess(res, 'Branch customer analytics retrieved successfully.', result);
    } catch (error) {
      next(error);
    }
  };

  getAllBranchesOverview = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await branchAnalyticsService.getAllBranchesOverview();
      sendSuccess(res, 'All branches overview analytics retrieved successfully.', result);
    } catch (error) {
      next(error);
    }
  };
}

export const branchAnalyticsController = new BranchAnalyticsController();
