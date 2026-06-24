import request from 'supertest';
import app from '../src/app';
import { disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Product Intelligence API Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;

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
  });

  afterAll(async () => {
    await disconnectPrisma();
    await disconnectRedis();
  });

  describe('GET /api/v1/analytics/executive/products/top', () => {
    it('should return top selling items for admin (default month)', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/executive/products/top')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should accept period query param for top items', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/executive/products/top?period=week')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/analytics/executive/products/worst', () => {
    it('should return worst selling items for admin', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/executive/products/worst')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/analytics/executive/products/revenue', () => {
    it('should return highest revenue items for admin', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/executive/products/revenue')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should accept period query param for revenue items', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/executive/products/revenue?period=year')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('RBAC', () => {
    it('should reject CUSTOMER role from product intelligence', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/executive/products/top')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('should reject CUSTOMER from worst items', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/executive/products/worst')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/analytics/executive/products/top');
      expect(res.status).toBe(401);
    });
  });
});
