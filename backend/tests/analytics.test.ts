import request from 'supertest';
import app from '../src/app';
import { disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Analytics API Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    // Login as admin
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@elixirandoak.in',
      password: 'Password123!',
    });
    adminToken = loginRes.body.data.accessToken;

    // Login as customer for RBAC test
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

  describe('Dashboard Analytics', () => {
    it('should return cached dashboard on repeated calls', async () => {
      const res1 = await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res2.status).toBe(200);
      expect(res2.body.data.totalOrders).toBe(res1.body.data.totalOrders);
    });

    it('should get dashboard data', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalOrders');
      expect(res.body.data).toHaveProperty('ordersToday');
      expect(res.body.data).toHaveProperty('revenueToday');
      expect(res.body.data).toHaveProperty('revenueThisMonth');
      expect(res.body.data).toHaveProperty('averageOrderValue');
      expect(res.body.data).toHaveProperty('topSellingItems');
      expect(res.body.data).toHaveProperty('lowStockCount');
      expect(res.body.data).toHaveProperty('pendingReservations');
      expect(res.body.data).toHaveProperty('activeKitchenTickets');
      expect(Array.isArray(res.body.data.topSellingItems)).toBe(true);
    });
  });

  describe('Order Analytics', () => {
    it('should get order analytics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/orders')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('pending');
      expect(res.body.data).toHaveProperty('confirmed');
      expect(res.body.data).toHaveProperty('delivered');
    });
  });

  describe('Revenue Analytics', () => {
    it('should get revenue analytics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/revenue')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalRevenue');
      expect(res.body.data).toHaveProperty('averageOrderValue');
      expect(res.body.data).toHaveProperty('totalOrders');
    });
  });

  describe('Inventory Analytics', () => {
    it('should get inventory analytics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/inventory')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('lowStockCount');
      expect(res.body.data).toHaveProperty('totalIngredients');
      expect(res.body.data).toHaveProperty('totalSuppliers');
      expect(res.body.data).toHaveProperty('pendingPurchaseOrders');
    });
  });

  describe('RBAC', () => {
    it('should reject CUSTOMER role from accessing analytics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests to analytics', async () => {
      const res = await request(app).get('/api/v1/analytics/dashboard');

      expect(res.status).toBe(401);
    });
  });
});
