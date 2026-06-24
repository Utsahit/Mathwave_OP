import request from 'supertest';
import app from '../src/app';
import { disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Loyalty API Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let testUserId: string;

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
    testUserId = customerLogin.body.data.user.id;
  });

  afterAll(async () => {
    await disconnectPrisma();
    await disconnectRedis();
  });

  describe('GET /api/v1/loyalty/balance', () => {
    it('should return loyalty balance for authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/loyalty/balance')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('balance');
      expect(typeof res.body.data.balance).toBe('number');
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/loyalty/balance');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/loyalty/history', () => {
    it('should return paginated history', async () => {
      const res = await request(app)
        .get('/api/v1/loyalty/history')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('total');
    });
  });

  describe('POST /api/v1/loyalty/redeem', () => {
    it('should fail with insufficient balance', async () => {
      const res = await request(app)
        .post('/api/v1/loyalty/redeem')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ points: 999999 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INSUFFICIENT_POINTS');
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).post('/api/v1/loyalty/redeem').send({ points: 100 });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/loyalty/adjust (RBAC)', () => {
    it('should reject CUSTOMER from adjusting points', async () => {
      const res = await request(app)
        .post('/api/v1/loyalty/adjust')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ userId: testUserId, points: 100, description: 'test' });

      expect(res.status).toBe(403);
    });

    it('should allow ADMIN to adjust points', async () => {
      const res = await request(app)
        .post('/api/v1/loyalty/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: testUserId, points: 50, description: 'Admin adjustment test' });

      expect(res.status === 200 || res.status === 201).toBe(true);
    });
  });
});
