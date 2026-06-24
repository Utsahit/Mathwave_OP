import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { automationService } from '../services/automation.service';
import { sendSuccess } from '../utils/response';

export class MarketingController {
  listAutomations = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await automationService.listAutomations(page, limit);
      sendSuccess(res, 'Automations retrieved successfully.', result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  };

  createAutomation = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const automation = await automationService.createAutomation(req.body);
      sendSuccess(res, 'Automation created successfully.', automation, {}, 201);
    } catch (err) {
      next(err);
    }
  };

  updateAutomation = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const automation = await automationService.updateAutomation(
        req.params.id,
        req.body
      );
      sendSuccess(res, 'Automation updated successfully.', automation);
    } catch (err) {
      next(err);
    }
  };
}

export const marketingController = new MarketingController();
