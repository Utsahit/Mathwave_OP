import { Router } from 'express';
import { pushNotificationController } from '../controllers/push-notification.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/register', requireAuth(), pushNotificationController.registerToken);
router.post('/unregister', requireAuth(), pushNotificationController.unregisterToken);

export default router;
