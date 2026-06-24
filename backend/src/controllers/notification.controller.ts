import { Response, NextFunction } from 'express';
import { notificationService } from '../services/notification.service';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth';

export class NotificationController {
  listNotifications = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const data = await notificationService.listNotifications(
        req.user!.userId,
        page,
        pageSize
      );
      sendSuccess(res, 'Notifications retrieved successfully.', data.data, {
        total: data.total,
        page,
        pageSize,
      });
    } catch (err) {
      next(err);
    }
  };

  getUnreadCount = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const count = await notificationService.getUnreadCount(req.user!.userId);
      sendSuccess(res, 'Unread count retrieved.', { count });
    } catch (err) {
      next(err);
    }
  };

  markAsRead = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await notificationService.markAsRead(req.params.id, req.user!.userId);
      sendSuccess(res, 'Notification marked as read.');
    } catch (err) {
      next(err);
    }
  };

  markAllAsRead = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await notificationService.markAllAsRead(req.user!.userId);
      sendSuccess(res, 'All notifications marked as read.');
    } catch (err) {
      next(err);
    }
  };

  getPreferences = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const prefs = await notificationService.getPreferences(req.user!.userId);
      sendSuccess(res, 'Notification preferences retrieved.', prefs);
    } catch (err) {
      next(err);
    }
  };

  updatePreferences = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const prefs = await notificationService.updatePreferences(
        req.user!.userId,
        req.body
      );
      sendSuccess(res, 'Notification preferences updated.', prefs);
    } catch (err) {
      next(err);
    }
  };
}

export const notificationController = new NotificationController();
