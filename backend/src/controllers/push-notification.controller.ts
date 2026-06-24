import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { pushNotificationService } from '../services/push-notification.service';
import { sendSuccess } from '../utils/response';

export class PushNotificationController {
  registerToken = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { deviceType, token } = req.body;
      const result = await pushNotificationService.registerToken(
        req.user!.userId,
        deviceType,
        token
      );
      sendSuccess(res, 'Push token registered successfully.', result, {}, 201);
    } catch (err) {
      next(err);
    }
  };

  unregisterToken = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { token } = req.body;
      await pushNotificationService.unregisterToken(token);
      sendSuccess(res, 'Push token unregistered successfully.');
    } catch (err) {
      next(err);
    }
  };
}

export const pushNotificationController = new PushNotificationController();
