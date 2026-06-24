import request from 'supertest';
import app from '../src/app';
import { disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Customer Intelligence API Integration Tests', () => {
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

  describe('GET /api/v1/analytics/executive/customers/rfm', () => {
    it('should return RFM analysis for admin', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/executive/customers/rfm')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('segments');
      expect(res.body.data.segments).toHaveProperty('Champions');
      expect(res.body.data.segments).toHaveProperty('Loyal Customers');
      expect(res.body.data.segments).toHaveProperty('At Risk');
      expect(res.body.data).toHaveProperty('averageRfm');
    });

    it('should reject CUSTOMER', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/executive/customers/rfm')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/analytics/executive/customers/cohort', () => {
    it('should return cohort analysis for admin', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/executive/customers/cohort')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('cohorts');
      expect(Array.isArray(res.body.data.cohorts)).toBe(true);
      expect(Array.isArray(res.body.data.cohorts)).toBe(true);
    });

    it('should return cohort data with month and retention metrics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/executive/customers/cohort')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      if (res.body.data.cohorts.length > 0) {
        expect(res.body.data.cohorts[0]).toHaveProperty('month');
        expect(res.body.data.cohorts[0]).toHaveProperty('customers');
        expect(res.body.data.cohorts[0]).toHaveProperty('retentionRate');
      }
    });
  });
});
