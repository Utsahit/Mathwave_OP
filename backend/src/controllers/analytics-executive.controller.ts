import { Request, Response, NextFunction } from 'express';
import { analyticsExecutiveService } from '../services/analytics-executive.service';
import { forecastService } from '../services/forecast.service';
import { customerIntelligenceService } from '../services/customer-intelligence.service';
import { productIntelligenceService } from '../services/product-intelligence.service';
import { branchRankingService } from '../services/branch-ranking.service';
import { sendSuccess } from '../utils/response';

export class AnalyticsExecutiveController {
  getExecutiveDashboard = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await analyticsExecutiveService.getExecutiveDashboard();
      sendSuccess(res, 'Executive dashboard retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getRevenueDashboard = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await analyticsExecutiveService.getRevenueDashboard();
      sendSuccess(res, 'Revenue dashboard retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getOrderDashboard = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await analyticsExecutiveService.getOrderDashboard();
      sendSuccess(res, 'Order dashboard retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getReservationDashboard = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await analyticsExecutiveService.getReservationDashboard();
      sendSuccess(res, 'Reservation dashboard retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getCustomerDashboard = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await analyticsExecutiveService.getCustomerDashboard();
      sendSuccess(res, 'Customer dashboard retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getRevenueForecast = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await forecastService.getRevenueForecast();
      sendSuccess(res, 'Revenue forecast retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getOrderForecast = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await forecastService.getOrderForecast();
      sendSuccess(res, 'Order forecast retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getRfmAnalysis = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await customerIntelligenceService.getRfmAnalysis();
      sendSuccess(res, 'RFM analysis retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getCohortAnalysis = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await customerIntelligenceService.getCohortAnalysis();
      sendSuccess(res, 'Cohort analysis retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getTopSellingItems = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const period = (req.query.period as 'day' | 'week' | 'month' | 'year') || 'month';
      const data = await productIntelligenceService.getTopSellingItems(period);
      sendSuccess(res, 'Top selling items retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getWorstSellingItems = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const period = (req.query.period as 'day' | 'week' | 'month' | 'year') || 'month';
      const data = await productIntelligenceService.getWorstSellingItems(period);
      sendSuccess(res, 'Worst selling items retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getHighestRevenueItems = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const period = (req.query.period as 'day' | 'week' | 'month' | 'year') || 'month';
      const data = await productIntelligenceService.getHighestRevenueItems(period);
      sendSuccess(res, 'Highest revenue items retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getBranchRankings = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await branchRankingService.getRankings();
      sendSuccess(res, 'Branch rankings retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };
}

export const analyticsExecutiveController = new AnalyticsExecutiveController();
