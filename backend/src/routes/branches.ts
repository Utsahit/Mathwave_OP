import { Router } from 'express';
import { branchController } from '../controllers/branch.controller';
import { branchAnalyticsController } from '../controllers/branch-analytics.controller';
import { branchStaffController } from '../controllers/branch-staff.controller';
import { validate } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import { branchScopeMiddleware } from '../middleware/branch-context';
import { canAccessBranch } from '../utils/branch-scope';
import { AppError } from '../utils/app-error';
import {
  createBranchSchema,
  updateBranchSchema,
  branchQuerySchema,
  assignStaffSchema,
} from '../validators/branch.validator';

const router = Router();

router.use(requireAuth());
router.use(branchScopeMiddleware);

router.get(
  '/',
  requirePermission('branch:view'),
  validate(branchQuerySchema),
  branchController.listBranches
);
router.post(
  '/',
  requirePermission('branch:create'),
  validate(createBranchSchema),
  branchController.createBranch
);
router.get('/:id', requirePermission('branch:view'), branchController.getBranch);
router.put(
  '/:id',
  requirePermission('branch:update'),
  validate(updateBranchSchema),
  branchController.updateBranch
);
router.delete('/:id', requirePermission('branch:delete'), branchController.deleteBranch);

// Branch analytics – reject if user's scope excludes the requested branch
function checkBranchAccess(req: any, _res: any, next: any) {
  const branchId = req.params.id;
  if (
    branchId &&
    req.branchScope !== null &&
    req.branchScope !== undefined &&
    !canAccessBranch(req.branchScope, branchId)
  ) {
    return next(
      new AppError('You do not have access to this branch.', 403, 'BRANCH_ACCESS_DENIED')
    );
  }
  next();
}

router.get(
  '/:id/analytics/sales',
  requirePermission('branch:analytics'),
  checkBranchAccess,
  branchAnalyticsController.getBranchSales
);
router.get(
  '/:id/analytics/inventory',
  requirePermission('branch:inventory'),
  checkBranchAccess,
  branchAnalyticsController.getBranchInventory
);
router.get(
  '/:id/analytics/reservations',
  requirePermission('branch:analytics'),
  checkBranchAccess,
  branchAnalyticsController.getBranchReservations
);
router.get(
  '/:id/analytics/loyalty',
  requirePermission('branch:analytics'),
  checkBranchAccess,
  branchAnalyticsController.getBranchLoyalty
);
router.get(
  '/:id/analytics/customers',
  requirePermission('branch:analytics'),
  checkBranchAccess,
  branchAnalyticsController.getBranchCustomers
);

// Branch staff management
router.get(
  '/:id/staff',
  requirePermission('branch:staff'),
  branchStaffController.listStaff
);
router.post(
  '/staff',
  requirePermission('branch:staff'),
  validate(assignStaffSchema),
  branchStaffController.assignStaff
);
router.delete(
  '/:branchId/staff/:userId',
  requirePermission('branch:staff'),
  branchStaffController.removeStaff
);

export default router;
