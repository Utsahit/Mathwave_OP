import { Router } from 'express';
import { orderController } from '../controllers/order.controller';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { branchScopeMiddleware } from '../middleware/branch-context';
import {
  createOrderSchema,
  orderQuerySchema,
  updateOrderStatusSchema,
} from '../validators/order.validator';

const router = Router();

// Public/Customer routes
router.post('/', validate({ body: createOrderSchema }), orderController.createOrder);
router.get('/my-orders', requireAuth(), orderController.listUserOrders);
router.get('/number/:orderNumber', requireAuth(), orderController.getOrderByNumber);
router.get('/:id', requireAuth(), orderController.getOrder);

// Admin/Manager routes
router.get(
  '/admin/stats',
  requireAuth(),
  requirePermission('order:view'),
  orderController.getStats
);
router.get(
  '/admin/list',
  requireAuth(),
  requirePermission('order:view'),
  branchScopeMiddleware,
  validate({ query: orderQuerySchema }),
  orderController.listOrders
);
router.put(
  '/admin/:id/status',
  requireAuth(),
  requirePermission('order:update'),
  validate({ body: updateOrderStatusSchema }),
  orderController.updateStatus
);

export default router;
