import request from 'supertest';
import app from '../src/app';
import { disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Mobile API Integration Tests', () => {
  let customerToken: string;

  beforeAll(async () => {
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

  describe('GET /api/v1/mobile/dashboard', () => {
    it('should return mobile dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/mobile/dashboard')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('upcomingReservations');
      expect(res.body.data).toHaveProperty('recentOrders');
      expect(res.body.data).toHaveProperty('favoriteCount');
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/mobile/dashboard');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/mobile/profile', () => {
    it('should return user profile', async () => {
      const res = await request(app)
        .get('/api/v1/mobile/profile')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('name');
      expect(res.body.data).toHaveProperty('email');
    });
  });

  describe('GET /api/v1/mobile/orders', () => {
    it('should return paginated orders', async () => {
      const res = await request(app)
        .get('/api/v1/mobile/orders')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/mobile/reservations', () => {
    it('should return paginated reservations', async () => {
      const res = await request(app)
        .get('/api/v1/mobile/reservations')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
