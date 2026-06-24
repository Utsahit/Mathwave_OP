import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { recommendationService } from '../services/recommendation.service';
import { sendSuccess } from '../utils/response';

export class RecommendationController {
  getRecommendations = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limit = Number(req.query.limit) || 10;
      const items = await recommendationService.getRecommendations(
        req.user!.userId,
        limit
      );
      sendSuccess(res, 'Recommendations retrieved successfully.', items);
    } catch (err) {
      next(err);
    }
  };
}

export const recommendationController = new RecommendationController();
