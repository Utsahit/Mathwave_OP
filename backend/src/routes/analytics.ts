import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller';
import { requireAuth, requirePermission } from '../middleware/auth';
import { branchScopeMiddleware } from '../middleware/branch-context';

const router = Router();

router.get(
  '/dashboard',
  requireAuth(),
  requirePermission('analytics:view'),
  analyticsController.getDashboard
);

router.get(
  '/orders',
  requireAuth(),
  requirePermission('analytics:view'),
  analyticsController.getOrderAnalytics
);

router.get(
  '/revenue',
  requireAuth(),
  requirePermission('analytics:view'),
  analyticsController.getRevenueAnalytics
);

router.get(
  '/inventory',
  requireAuth(),
  requirePermission('analytics:view'),
  analyticsController.getInventoryAnalytics
);

router.get(
  '/loyalty',
  requireAuth(),
  requirePermission('analytics:view'),
  analyticsController.getLoyaltyAnalytics
);

router.get(
  '/branches',
  requireAuth(),
  requirePermission('analytics:view'),
  branchScopeMiddleware,
  analyticsController.getBranchOverview
);

router.get(
  '/favorites',
  requireAuth(),
  requirePermission('analytics:view'),
  analyticsController.getFavoritesAnalytics
);

router.get(
  '/retention',
  requireAuth(),
  requirePermission('analytics:view'),
  analyticsController.getCustomerRetention
);

router.get(
  '/segments',
  requireAuth(),
  requirePermission('analytics:view'),
  analyticsController.getTopCustomerSegments
);

router.get(
  '/support-metrics',
  requireAuth(),
  requirePermission('analytics:view'),
  analyticsController.getSupportTicketMetrics
);

router.get(
  '/marketing',
  requireAuth(),
  requirePermission('analytics:view'),
  analyticsController.getMarketingAnalytics
);

export default router;
