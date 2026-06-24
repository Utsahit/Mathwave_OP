import { Router } from 'express';
import { analyticsExecutiveController } from '../controllers/analytics-executive.controller';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();

router.use(requireAuth());

router.get(
  '/dashboard',
  requirePermission('analytics:executive'),
  analyticsExecutiveController.getExecutiveDashboard
);

router.get(
  '/revenue',
  requirePermission('analytics:executive'),
  analyticsExecutiveController.getRevenueDashboard
);

router.get(
  '/orders',
  requirePermission('analytics:executive'),
  analyticsExecutiveController.getOrderDashboard
);

router.get(
  '/reservations',
  requirePermission('analytics:executive'),
  analyticsExecutiveController.getReservationDashboard
);

router.get(
  '/customers',
  requirePermission('analytics:executive'),
  analyticsExecutiveController.getCustomerDashboard
);

router.get(
  '/forecast/revenue',
  requirePermission('analytics:forecast'),
  analyticsExecutiveController.getRevenueForecast
);

router.get(
  '/forecast/orders',
  requirePermission('analytics:forecast'),
  analyticsExecutiveController.getOrderForecast
);

router.get(
  '/customers/rfm',
  requirePermission('analytics:executive'),
  analyticsExecutiveController.getRfmAnalysis
);

router.get(
  '/customers/cohort',
  requirePermission('analytics:executive'),
  analyticsExecutiveController.getCohortAnalysis
);

router.get(
  '/products/top',
  requirePermission('analytics:executive'),
  analyticsExecutiveController.getTopSellingItems
);

router.get(
  '/products/worst',
  requirePermission('analytics:executive'),
  analyticsExecutiveController.getWorstSellingItems
);

router.get(
  '/products/revenue',
  requirePermission('analytics:executive'),
  analyticsExecutiveController.getHighestRevenueItems
);

router.get(
  '/branches/ranking',
  requirePermission('analytics:executive'),
  analyticsExecutiveController.getBranchRankings
);

export default router;
