import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/response';
import { securityService } from '../services/security.service';

export class SecurityController {
  getDashboard = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await securityService.getDashboard();
      sendSuccess(res, 'Security dashboard data retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  };
}

export const securityController = new SecurityController();
