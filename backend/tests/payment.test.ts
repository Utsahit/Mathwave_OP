import request from 'supertest';
import app from '../src/app';
import { prisma, disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';
import crypto from 'crypto';
import { env } from '../src/config/env';
import { paymentService } from '../src/services/payment.service';

const FAKE_RAZORPAY_ORDER_ID = `order_fake_rzp_${Date.now()}`;
const FAKE_RAZORPAY_PAYMENT_ID = `pay_fake_rzp_${Date.now()}`;

describe('Payment API Integration Tests', () => {
  let orderId: string;

  beforeAll(async () => {
    // Create a fresh Order in the database for each test run
    const order = await prisma.order.create({
      data: {
        orderNumber: `EO-PAY-TEST-${Date.now()}`,
        totalAmount: 100,
        taxAmount: 5,
        finalAmount: 105,
        customerName: 'Payment Tester',
        customerEmail: `paytester_${Date.now()}@example.com`,
        customerPhone: '9999999999',
      },
    });
    orderId = order.id;
  });

  afterAll(async () => {
    await disconnectPrisma();
    await disconnectRedis();
  });

  describe('Razorpay payment initialization & signature validation', () => {
    it('should initialize a payment order with Razorpay', async () => {
      // Stub the SDK call at the service level to avoid actual gateway hit
      jest.spyOn(paymentService, 'createRazorpayOrder').mockResolvedValueOnce({
        key: 'rzp_test_change_me',
        amount: 10500,
        currency: 'INR',
        razorpayOrderId: FAKE_RAZORPAY_ORDER_ID,
        orderId,
        orderNumber: 'EO-PAY-TEST-MOCK',
      });

      const res = await request(app).post('/api/v1/payments/razorpay').send({ orderId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.razorpayOrderId).toBe(FAKE_RAZORPAY_ORDER_ID);
    });

    it('should verify payment signature successfully', async () => {
      // Seed a fresh transaction row (unique razorpayOrderId per run)
      const tx = await prisma.transaction.create({
        data: {
          orderId,
          razorpayOrderId: FAKE_RAZORPAY_ORDER_ID,
          amount: 105,
          status: 'CREATED',
        },
      });
      expect(tx).toBeTruthy();

      const secret = env.RAZORPAY_KEY_SECRET || 'rzp_secret_change_me';
      const text = `${FAKE_RAZORPAY_ORDER_ID}|${FAKE_RAZORPAY_PAYMENT_ID}`;
      const razorpaySignature = crypto
        .createHmac('sha256', secret)
        .update(text)
        .digest('hex');

      const res = await request(app).post('/api/v1/payments/verify').send({
        orderId,
        razorpayOrderId: FAKE_RAZORPAY_ORDER_ID,
        razorpayPaymentId: FAKE_RAZORPAY_PAYMENT_ID,
        razorpaySignature,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PAID');
    });

    it('should process webhook capture idempotently', async () => {
      const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_change_me';
      const eventId = `evt_fake_${Date.now()}`;
      const payload = {
        id: eventId,
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: FAKE_RAZORPAY_PAYMENT_ID,
              order_id: FAKE_RAZORPAY_ORDER_ID,
              amount: 10500,
              status: 'captured',
            },
          },
        },
      };

      const bodyRaw = JSON.stringify(payload);
      const signatureHeader = crypto
        .createHmac('sha256', webhookSecret)
        .update(bodyRaw)
        .digest('hex');

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('x-razorpay-signature', signatureHeader)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject invalid webhook signatures', async () => {
      const payload = {
        id: `evt_fake_invalid_${Date.now()}`,
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_bad', order_id: 'order_bad' } } },
      };

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('x-razorpay-signature', 'bad_signature_value')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVALID_SIGNATURE');
    });
  });
});
