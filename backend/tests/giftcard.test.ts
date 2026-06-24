import request from 'supertest';
import app from '../src/app';
import { prisma, disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Gift Card API Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let testGiftCardId: string;
  let testOrderId: string;
  const testCode = `GC${Date.now()}`;

  beforeAll(async () => {
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@elixirandoak.in',
      password: 'Password123!',
    });
    adminToken = adminLogin.body.data.accessToken;

    const customerLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'customer@elixirandoak.in',
      password: 'Password123!',
    });
    customerToken = customerLogin.body.data.accessToken;

    // Create a real order for gift card redemption tests
    const adminUser = await prisma.user.findFirst({
      where: { email: 'admin@elixirandoak.in' },
    });
    if (adminUser) {
      const catSlug = `gc-test-cat-${Date.now()}`;
      const category = await prisma.menuCategory.create({
        data: { name: catSlug, slug: catSlug },
      });
      const menuItem = await prisma.menuItem.create({
        data: {
          name: 'GiftCard Test Item',
          slug: `gc-test-item-${Date.now()}`,
          price: 100,
          description: 'test',
          categoryId: category.id,
        },
      });
      const order = await prisma.order.create({
        data: {
          orderNumber: `GC-TEST-${Date.now()}`,
          userId: adminUser.id,
          customerName: 'Test Customer',
          customerEmail: 'test@example.com',
          customerPhone: '9999999999',
          totalAmount: 100,
          subtotalAmount: 100,
          taxAmount: 0,
          finalAmount: 100,
          status: 'PENDING',
          items: {
            create: {
              menuItemId: menuItem.id,
              quantity: 1,
              unitPrice: 100,
              totalPrice: 100,
            },
          },
        },
      });
      testOrderId = order.id;
    }
  });

  afterAll(async () => {
    if (testGiftCardId) {
      await prisma.giftCardRedemption
        .deleteMany({ where: { giftCardId: testGiftCardId } })
        .catch(() => {});
      await prisma.giftCard.deleteMany({ where: { id: testGiftCardId } }).catch(() => {});
    }
    if (testOrderId) {
      await prisma.giftCardRedemption
        .deleteMany({ where: { orderId: testOrderId } })
        .catch(() => {});
    }
    await disconnectPrisma();
    await disconnectRedis();
  });

  describe('POST /api/v1/admin/giftcards (create)', () => {
    it('should allow ADMIN to create gift card', async () => {
      const res = await request(app)
        .post('/api/v1/admin/giftcards')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: testCode, originalAmount: 1000 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(Number(res.body.data.originalAmount)).toBe(1000);
      testGiftCardId = res.body.data.id;
    });

    it('should reject CUSTOMER from creating gift card', async () => {
      const res = await request(app)
        .post('/api/v1/admin/giftcards')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ code: 'FAIL', originalAmount: 500 });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/admin/giftcards (list)', () => {
    it('should list gift cards for authorized user', async () => {
      const res = await request(app)
        .get('/api/v1/admin/giftcards')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('data');
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/admin/giftcards');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/admin/giftcards/redeem', () => {
    it('should redeem a valid gift card', async () => {
      const res = await request(app)
        .post('/api/v1/admin/giftcards/redeem')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: testCode,
          orderId: testOrderId,
          amount: 500,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('amountRedeemed');
    });

    it('should reject double-spend (exhausted balance)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/giftcards/redeem')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: testCode,
          orderId: testOrderId,
          amount: 600,
        });

      expect(res.status === 400 || res.status === 404).toBe(true);
    });
  });

  describe('PATCH /api/v1/admin/giftcards/:id/deactivate', () => {
    it('should allow ADMIN to deactivate gift card', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/giftcards/${testGiftCardId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('Concurrent Redemption Protection', () => {
    const concurrencyCode = `CONC${Date.now()}`;
    let concurrencyOrderA: string;
    let concurrencyOrderB: string;

    beforeAll(async () => {
      const adminUser = await prisma.user.findFirst({
        where: { email: 'admin@elixirandoak.in' },
      });

      // Create a dedicated gift card of 1000 directly
      const giftCard = await prisma.giftCard.create({
        data: { code: concurrencyCode, originalAmount: 1000, remainingAmount: 1000 },
      });
      testGiftCardId = giftCard.id;

      // Create two orders for concurrent redemption attempts
      const catSlug = `gc-concat-${Date.now()}`;
      const category = await prisma.menuCategory.create({
        data: { name: catSlug, slug: catSlug },
      });
      const menuItem = await prisma.menuItem.create({
        data: {
          name: 'Concurrent Test Item',
          slug: `gc-conc-item-${Date.now()}`,
          price: 100,
          description: 'test',
          categoryId: category.id,
        },
      });

      for (const suffix of ['A', 'B']) {
        const order = await prisma.order.create({
          data: {
            orderNumber: `GC-CONC-${Date.now()}-${suffix}`,
            userId: adminUser!.id,
            customerName: `Concurrent ${suffix}`,
            customerEmail: `conc${suffix}@test.com`,
            customerPhone: '9999999999',
            totalAmount: 100,
            subtotalAmount: 100,
            taxAmount: 0,
            finalAmount: 100,
            status: 'PENDING',
            items: {
              create: {
                menuItemId: menuItem.id,
                quantity: 1,
                unitPrice: 100,
                totalPrice: 100,
              },
            },
          },
        });
        if (suffix === 'A') concurrencyOrderA = order.id;
        else concurrencyOrderB = order.id;
      }
    });

    it('should prevent lost update under concurrent redemption (sum <= original amount)', async () => {
      // Fire two concurrent redemptions of 600 each on a 1000 card
      const [resA, resB] = await Promise.all([
        request(app)
          .post('/api/v1/admin/giftcards/redeem')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ code: concurrencyCode, orderId: concurrencyOrderA, amount: 600 }),
        request(app)
          .post('/api/v1/admin/giftcards/redeem')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ code: concurrencyCode, orderId: concurrencyOrderB, amount: 600 }),
      ]);

      // At most one should succeed; the other must fail
      const succeeded = [resA, resB].filter((r) => r.status === 200);
      const failed = [resA, resB].filter((r) => r.status !== 200);

      expect(succeeded.length).toBeLessThanOrEqual(1);
      expect(failed.length).toBeGreaterThanOrEqual(1);
      expect(failed[0].status).toBe(400);

      // Verify the DB is not corrupted
      const final = await prisma.giftCard.findUnique({
        where: { code: concurrencyCode },
        select: { remainingAmount: true },
      });
      const remaining = Number(final!.remainingAmount);
      // If one succeeded (600 redeemed), remaining = 400.
      // If none succeeded (theoretical), remaining = 1000.
      expect(remaining).toBeGreaterThanOrEqual(0);
      expect(remaining).toBeLessThanOrEqual(1000);

      // Total debited must not exceed original 1000
      const redemptions = await prisma.giftCardRedemption.findMany({
        where: {
          giftCardId: (await prisma.giftCard.findUnique({
            where: { code: concurrencyCode },
            select: { id: true },
          }))!.id,
        },
        select: { amount: true },
      });
      const totalRedeemed = redemptions.reduce((sum, r) => sum + Number(r.amount), 0);
      expect(totalRedeemed + remaining).toBe(1000);
      expect(totalRedeemed).toBeLessThanOrEqual(1000);
    });
  });
});
