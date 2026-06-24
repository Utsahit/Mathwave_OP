import { Router } from 'express';
import { franchiseController } from '../controllers/franchise.controller';
import { validate } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import {
  createFranchiseSchema,
  updateFranchiseSchema,
  assignBranchSchema,
} from '../validators/branch.validator';

const router = Router();

router.use(requireAuth());

router.get('/', requirePermission('franchise:view'), franchiseController.listFranchises);
router.post(
  '/',
  requirePermission('franchise:create'),
  validate(createFranchiseSchema),
  franchiseController.createFranchise
);
router.put(
  '/:id',
  requirePermission('franchise:update'),
  validate(updateFranchiseSchema),
  franchiseController.updateFranchise
);
router.post(
  '/assign-branch',
  requirePermission('franchise:update'),
  validate(assignBranchSchema),
  franchiseController.assignBranch
);
router.post(
  '/:id/remove-branch',
  requirePermission('franchise:update'),
  franchiseController.removeBranch
);

export default router;
