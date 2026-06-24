import request from 'supertest';
import app from '../src/app';
import { prisma, disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Coupon API Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let staffToken: string;
  let testCouponId: string;
  const testCode = `TEST${Date.now()}`;

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

    const staffLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'staff@elixirandoak.in',
      password: 'Password123!',
    });
    staffToken = staffLogin.body.data.accessToken;
  });

  afterAll(async () => {
    if (testCouponId) {
      await prisma.couponRedemption
        .deleteMany({ where: { couponId: testCouponId } })
        .catch(() => {});
      await prisma.coupon.deleteMany({ where: { id: testCouponId } }).catch(() => {});
    }
    await disconnectPrisma();
    await disconnectRedis();
  });

  describe('POST /api/v1/coupons (create)', () => {
    it('should allow ADMIN to create coupon', async () => {
      const past = new Date(Date.now() - 3600000); // 1 hour ago
      const futureExpiry = new Date();
      futureExpiry.setDate(futureExpiry.getDate() + 30);

      const res = await request(app)
        .post('/api/v1/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: testCode,
          type: 'PERCENTAGE',
          value: 10,
          minimumOrderValue: 500,
          maxDiscount: 100,
          usageLimit: 100,
          startsAt: past.toISOString(),
          expiresAt: futureExpiry.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      testCouponId = res.body.data.id;
    });

    it('should reject CUSTOMER from creating coupon', async () => {
      const res = await request(app)
        .post('/api/v1/coupons')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          code: 'FAIL',
          type: 'PERCENTAGE',
          value: 10,
          startsAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/coupons (list)', () => {
    it('should list coupons for authorized user', async () => {
      const res = await request(app)
        .get('/api/v1/coupons')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('data');
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/coupons');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/coupons/validate', () => {
    it('should validate a valid coupon', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: testCode, orderValue: 1000 });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(true);
    });
  });

  describe('POST /api/v1/coupons/validate (invalid coupon)', () => {
    it('should reject non-existent coupon', async () => {
      const res = await request(app)
        .post('/api/v1/coupons/validate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: 'NONEXISTENT', orderValue: 1000 });

      expect(res.status).toBe(404);
    });
  });

  describe('RBAC', () => {
    it('should reject CUSTOMER from listing coupons', async () => {
      const res = await request(app)
        .get('/api/v1/coupons')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject STAFF from viewing coupons', async () => {
      const res = await request(app)
        .get('/api/v1/coupons')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
    });
  });
});
