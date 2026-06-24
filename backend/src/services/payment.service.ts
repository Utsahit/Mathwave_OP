import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../config/env';
import { paymentRepository } from '../repositories/payment.repository';
import { orderRepository } from '../repositories/order.repository';
import { orderService } from './order.service';
import { AppError } from '../utils/app-error';
import { logger } from '../config/logger';
import { PaymentStatus, OrderStatus } from '@prisma/client';

/**
 * Returns a lazily-initialized Razorpay SDK instance.
 * Using a getter pattern guarantees the module-level mock in Jest
 * is evaluated AFTER the jest.mock() factory runs, not at module load time.
 */
function getRazorpay(): Razorpay {
  return new Razorpay({
    key_id: env.RAZORPAY_KEY_ID || 'rzp_test_change_me',
    key_secret: env.RAZORPAY_KEY_SECRET || 'rzp_secret_change_me',
  });
}

export class PaymentService {
  async createRazorpayOrder(orderId: string) {
    const order = await orderRepository.findOrderById(orderId);
    if (!order) {
      throw new AppError('Order not found.', 404, 'NOT_FOUND');
    }

    const alreadyPaid = await paymentRepository.isOrderAlreadyPaid(orderId);
    if (alreadyPaid) {
      throw new AppError('This order has already been paid.', 400, 'ALREADY_PAID');
    }

    const amountInPaise = Math.round(Number(order.finalAmount) * 100);

    // Create local transaction record
    const transaction = await paymentRepository.createTransaction({
      orderId,
      amount: order.finalAmount,
      status: PaymentStatus.CREATED,
    });

    try {
      // Lazily obtain the (possibly mocked) Razorpay SDK instance
      const razorpayClient = getRazorpay();

      const razorpayOrder = await razorpayClient.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: order.orderNumber,
        notes: {
          orderId,
          transactionId: transaction.id,
        },
      });

      // Update transaction with gateway metadata and razorpayOrderId (parameterized query)
      await paymentRepository.updateTransactionStatus(
        transaction.id,
        PaymentStatus.CREATED,
        null,
        razorpayOrder,
        razorpayOrder.id
      );

      return {
        key: env.RAZORPAY_KEY_ID || 'rzp_test_change_me',
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        razorpayOrderId: razorpayOrder.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
      };
    } catch (err) {
      logger.error({ err, orderId }, 'Razorpay order creation failed.');
      await paymentRepository.updateTransactionStatus(
        transaction.id,
        PaymentStatus.FAILED,
        null,
        err
      );
      throw new AppError(
        'Payment gateway integration failed. Please try again.',
        502,
        'GATEWAY_ERROR'
      );
    }
  }

  async verifyPaymentSignature(data: {
    orderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = data;

    // Local HMAC-SHA256 signature: razorpayOrderId + "|" + razorpayPaymentId
    const secret = env.RAZORPAY_KEY_SECRET || 'rzp_secret_change_me';
    const text = `${razorpayOrderId}|${razorpayPaymentId}`;
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(text)
      .digest('hex');

    const transaction =
      await paymentRepository.findTransactionByRazorpayOrderId(razorpayOrderId);
    if (!transaction) {
      throw new AppError('Payment transaction context not found.', 404, 'NOT_FOUND');
    }

    if (generatedSignature !== razorpaySignature) {
      logger.warn({ orderId, razorpayOrderId }, 'Razorpay signature mismatch.');
      await paymentRepository.updateTransactionStatus(
        transaction.id,
        PaymentStatus.FAILED,
        razorpayPaymentId,
        { error: 'Signature verification mismatch' }
      );
      throw new AppError(
        'Payment signature verification failed.',
        400,
        'SIGNATURE_MISMATCH'
      );
    }

    // Mark Transaction as PAID with full metadata snapshot
    try {
      const updatedTx = await paymentRepository.updateTransactionStatus(
        transaction.id,
        PaymentStatus.PAID,
        razorpayPaymentId,
        { status: 'captured', verified: true, signature: razorpaySignature }
      );

      // Advance Order lifecycle to CONFIRMED
      await orderService.updateOrderStatus(
        orderId,
        OrderStatus.CONFIRMED,
        'payment_service'
      );

      return updatedTx;
    } catch (err) {
      logger.error(
        { err, orderId, razorpayOrderId },
        'verifyPaymentSignature failed at final DB step.'
      );
      throw err;
    }
  }

  // ── Webhook Handler ──────────────────────────────────────────────────────────

  async processWebhook(signatureHeader: string, bodyRaw: string) {
    const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_change_me';

    // Verify Webhook Signature using HMAC-SHA256
    const generatedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(bodyRaw)
      .digest('hex');

    if (generatedSignature !== signatureHeader) {
      logger.warn('Razorpay webhook signature verification failed.');
      throw new AppError('Invalid webhook signature.', 400, 'INVALID_SIGNATURE');
    }

    const payload = JSON.parse(bodyRaw);
    const eventId = payload.id;
    const eventType = payload.event;

    // Idempotency guard — skip if already processed
    const existingEvent = await paymentRepository.findWebhookEvent('razorpay', eventId);
    if (existingEvent) {
      logger.info({ eventId }, 'Webhook event already processed (idempotency trigger).');
      return { success: true, message: 'Already processed' };
    }

    logger.info({ eventId, eventType }, 'Processing new Razorpay webhook event.');

    if (eventType === 'order.paid' || eventType === 'payment.captured') {
      const razorpayOrderId = payload.payload.payment.entity.order_id;
      const razorpayPaymentId = payload.payload.payment.entity.id;

      if (razorpayOrderId) {
        const transaction =
          await paymentRepository.findTransactionByRazorpayOrderId(razorpayOrderId);
        if (transaction && transaction.status !== PaymentStatus.PAID) {
          await paymentRepository.updateTransactionStatus(
            transaction.id,
            PaymentStatus.PAID,
            razorpayPaymentId,
            payload
          );

          await orderService.updateOrderStatus(
            transaction.orderId,
            OrderStatus.CONFIRMED,
            'webhook'
          );
        }
      }
    }

    // Register event as processed (idempotency record)
    await paymentRepository.createWebhookEvent('razorpay', eventId, eventType);

    return { success: true };
  }
}

export const paymentService = new PaymentService();
