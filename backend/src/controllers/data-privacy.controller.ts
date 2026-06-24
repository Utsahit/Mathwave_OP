import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/response';
import { dataPrivacyService } from '../services/data-privacy.service';

export class DataPrivacyController {
  async requestDeletion(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await dataPrivacyService.requestAccountDeletion(req.user!.userId);
    sendSuccess(res, result.message, result);
  }

  async exportData(req: AuthenticatedRequest, res: Response): Promise<void> {
    const data = await dataPrivacyService.exportPersonalData(req.user!.userId);
    sendSuccess(res, 'Personal data exported successfully', data);
  }
}

export const dataPrivacyController = new DataPrivacyController();
