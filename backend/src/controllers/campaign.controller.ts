import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { campaignService } from '../services/campaign.service';
import { sendSuccess } from '../utils/response';

export class CampaignController {
  listCampaigns = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await campaignService.listCampaigns(page, limit);
      sendSuccess(res, 'Campaigns retrieved successfully.', result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  };

  createCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const campaign = await campaignService.createCampaign({
        ...req.body,
        createdBy: req.user?.userId,
      });
      sendSuccess(res, 'Campaign created successfully.', campaign, {}, 201);
    } catch (err) {
      next(err);
    }
  };

  getCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const campaign = await campaignService.getCampaign(req.params.id);
      sendSuccess(res, 'Campaign retrieved successfully.', campaign);
    } catch (err) {
      next(err);
    }
  };

  updateCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const campaign = await campaignService.updateCampaign(req.params.id, req.body);
      sendSuccess(res, 'Campaign updated successfully.', campaign);
    } catch (err) {
      next(err);
    }
  };

  deleteCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await campaignService.deleteCampaign(req.params.id);
      sendSuccess(res, 'Campaign deleted successfully.');
    } catch (err) {
      next(err);
    }
  };

  startCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await campaignService.startCampaign(req.params.id);
      sendSuccess(res, 'Campaign started successfully.', result);
    } catch (err) {
      next(err);
    }
  };

  cancelCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await campaignService.cancelCampaign(req.params.id);
      sendSuccess(res, 'Campaign cancelled successfully.', result);
    } catch (err) {
      next(err);
    }
  };

  campaignAnalytics = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await campaignService.campaignAnalytics(req.params.id);
      sendSuccess(res, 'Campaign analytics retrieved successfully.', result);
    } catch (err) {
      next(err);
    }
  };
}

export const campaignController = new CampaignController();
