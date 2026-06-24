import { Router, raw } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { validate } from '../middleware/validate';
import { paymentLimiter } from '../middleware/rate-limiter';
import { paymentVerifySchema } from '../validators/order.validator';

const router = Router();

router.post('/razorpay', paymentLimiter, paymentController.createPayment);
router.post(
  '/verify',
  validate({ body: paymentVerifySchema }),
  paymentController.verifyPayment
);
router.post(
  '/webhook',
  raw({ type: 'application/json' }),
  paymentController.handleWebhook
);

export default router;
