import request from 'supertest';
import app from '../src/app';
import { disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Forecast API Integration Tests', () => {
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

  describe('GET /api/v1/analytics/executive/forecast/revenue', () => {
    it('should return revenue forecast for admin', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/executive/forecast/revenue')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('forecast7day');
      expect(res.body.data).toHaveProperty('forecast30day');
      expect(res.body.data).toHaveProperty('forecast90day');
    });

    it('should reject CUSTOMER role from forecast', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/executive/forecast/revenue')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/analytics/executive/forecast/orders', () => {
    it('should return order forecast', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/executive/forecast/orders')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('forecastDaily');
      expect(res.body.data).toHaveProperty('forecastWeekly');
      expect(res.body.data).toHaveProperty('forecastMonthly');
    });
  });

  describe('RBAC', () => {
    it('should reject unauthenticated requests to forecast', async () => {
      const res = await request(app).get('/api/v1/analytics/executive/forecast/revenue');
      expect(res.status).toBe(401);
    });
  });
});
