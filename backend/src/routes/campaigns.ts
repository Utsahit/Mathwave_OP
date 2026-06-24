import { Router } from 'express';
import { campaignController } from '../controllers/campaign.controller';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();

router.get(
  '/',
  requireAuth(),
  requirePermission('campaign:view'),
  campaignController.listCampaigns
);
router.post(
  '/',
  requireAuth(),
  requirePermission('campaign:create'),
  campaignController.createCampaign
);
router.get(
  '/:id',
  requireAuth(),
  requirePermission('campaign:view'),
  campaignController.getCampaign
);
router.put(
  '/:id',
  requireAuth(),
  requirePermission('campaign:update'),
  campaignController.updateCampaign
);
router.delete(
  '/:id',
  requireAuth(),
  requirePermission('campaign:delete'),
  campaignController.deleteCampaign
);
router.post(
  '/:id/start',
  requireAuth(),
  requirePermission('campaign:update'),
  campaignController.startCampaign
);
router.post(
  '/:id/cancel',
  requireAuth(),
  requirePermission('campaign:update'),
  campaignController.cancelCampaign
);
router.get(
  '/:id/analytics',
  requireAuth(),
  requirePermission('campaign:view'),
  campaignController.campaignAnalytics
);

export default router;
