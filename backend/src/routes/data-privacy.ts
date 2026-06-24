import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { dataPrivacyController } from '../controllers/data-privacy.controller';

const router = Router();

router.post('/deletion-request', requireAuth(), dataPrivacyController.requestDeletion);
router.get('/export', requireAuth(), dataPrivacyController.exportData);

export default router;
