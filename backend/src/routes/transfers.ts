import { Router } from 'express';
import { inventoryTransferController } from '../controllers/inventory-transfer.controller';
import { validate } from '../middleware/validate';
import { requireAuth, requirePermission } from '../middleware/auth';
import {
  createTransferSchema,
  transferQuerySchema,
} from '../validators/branch.validator';

const router = Router();

router.use(requireAuth());

router.get(
  '/',
  requirePermission('transfer:view'),
  validate(transferQuerySchema),
  inventoryTransferController.listTransfers
);
router.post(
  '/',
  requirePermission('transfer:create'),
  validate(createTransferSchema),
  inventoryTransferController.createTransfer
);
router.post(
  '/:id/approve',
  requirePermission('transfer:approve'),
  inventoryTransferController.approveTransfer
);
router.post(
  '/:id/complete',
  requirePermission('transfer:approve'),
  inventoryTransferController.completeTransfer
);
router.post(
  '/:id/cancel',
  requirePermission('transfer:approve'),
  inventoryTransferController.cancelTransfer
);

export default router;
