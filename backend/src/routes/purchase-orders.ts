import { Router } from 'express';
import { purchaseOrderController } from '../controllers/purchase-order.controller';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { branchScopeMiddleware } from '../middleware/branch-context';
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderStatusSchema,
} from '../validators/inventory.validator';

const router = Router();

router.post(
  '/',
  requireAuth(),
  requirePermission('purchase:create'),
  validate({ body: createPurchaseOrderSchema }),
  purchaseOrderController.createPurchaseOrder
);

router.get(
  '/',
  requireAuth(),
  requirePermission('purchase:view'),
  branchScopeMiddleware,
  purchaseOrderController.listPurchaseOrders
);

router.get(
  '/:id',
  requireAuth(),
  requirePermission('purchase:view'),
  purchaseOrderController.getPurchaseOrder
);

router.put(
  '/:id/status',
  requireAuth(),
  requirePermission('purchase:update'),
  validate({ body: updatePurchaseOrderStatusSchema }),
  purchaseOrderController.updatePurchaseOrderStatus
);

export default router;
