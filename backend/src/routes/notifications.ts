import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { updateNotificationPreferencesBodySchema } from '../validators/notification.validator';

const router = Router();

router.get(
  '/',
  requireAuth(),
  requirePermission('notification:view'),
  notificationController.listNotifications
);
router.get(
  '/unread-count',
  requireAuth(),
  requirePermission('notification:view'),
  notificationController.getUnreadCount
);
router.put(
  '/:id/read',
  requireAuth(),
  requirePermission('notification:update'),
  notificationController.markAsRead
);
router.put(
  '/read-all',
  requireAuth(),
  requirePermission('notification:update'),
  notificationController.markAllAsRead
);
router.get(
  '/preferences',
  requireAuth(),
  requirePermission('notification:view'),
  notificationController.getPreferences
);
router.put(
  '/preferences',
  requireAuth(),
  requirePermission('notification:update'),
  validate({ body: updateNotificationPreferencesBodySchema }),
  notificationController.updatePreferences
);

export default router;
