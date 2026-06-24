import { Router } from 'express';
import { cartController } from '../controllers/cart.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { addCartItemSchema, updateCartItemSchema } from '../validators/order.validator';

const router = Router();

// Guest/User Cart routes
router.get('/', cartController.getCart);
router.post('/items', validate({ body: addCartItemSchema }), cartController.addCartItem);
router.put(
  '/items/:id',
  validate({ body: updateCartItemSchema }),
  cartController.updateCartItem
);
router.delete('/items/:id', cartController.removeCartItem);
router.post('/merge', requireAuth(), cartController.mergeCart);

export default router;
