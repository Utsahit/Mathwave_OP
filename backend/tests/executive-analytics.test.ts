import request from 'supertest';
import app from '../src/app';
import { disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Executive Analytics API Integration Tests', () => {
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

  describe('GET /api/v1/analytics/executive/dashboard', () => {
    it('should return executive dashboard for admin', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/executive/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('revenue');
      expect(res.body.data).toHaveProperty('orders');
      expect(res.body.data).toHaveProperty('reservations');
      expect(res.body.data).toHaveProperty('customers');
      expect(res.body.data.revenue).toHaveProperty('todayRevenue');
      expect(res.body.data.revenue).toHaveProperty('weekRevenue');
      expect(res.body.data.revenue).toHaveProperty('monthRevenue');
      expect(res.body.data.revenue).toHaveProperty('growthPercentage');
      expect(res.body.data.orders).toHaveProperty('todayOrders');
      expect(res.body.data.orders).toHaveProperty('weekOrders');
      expect(res.body.data.orders).toHaveProperty('monthOrders');
      expect(res.body.data.orders).toHaveProperty('avgOrderValue');
      expect(res.body.data.reservations).toHaveProperty('todayReservations');
      expect(res.body.data.reservations).toHaveProperty('weekReservations');
      expect(res.body.data.reservations).toHaveProperty('utilizationRate');
      expect(res.body.data.customers).toHaveProperty('totalCustomers');
      expect(res.body.data.customers).toHaveProperty('repeatCustomers');
      expect(res.body.data.customers).toHaveProperty('newCustomers');
    });

    it('should reject CUSTOMER role from executive dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/executive/dashboard')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/analytics/executive/dashboard');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/analytics/executive/revenue', () => {
    it('should return revenue dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/executive/revenue')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('todayRevenue');
      expect(res.body.data).toHaveProperty('weekRevenue');
      expect(res.body.data).toHaveProperty('monthRevenue');
      expect(res.body.data).toHaveProperty('growthPercentage');
    });
  });

  describe('GET /api/v1/analytics/executive/orders', () => {
    it('should return order dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/executive/orders')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('todayOrders');
      expect(res.body.data).toHaveProperty('weekOrders');
      expect(res.body.data).toHaveProperty('monthOrders');
      expect(res.body.data).toHaveProperty('avgOrderValue');
    });
  });

  describe('GET /api/v1/analytics/executive/reservations', () => {
    it('should return reservation dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/executive/reservations')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('todayReservations');
      expect(res.body.data).toHaveProperty('weekReservations');
      expect(res.body.data).toHaveProperty('utilizationRate');
    });
  });

  describe('GET /api/v1/analytics/executive/customers', () => {
    it('should return customer dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/executive/customers')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalCustomers');
      expect(res.body.data).toHaveProperty('repeatCustomers');
      expect(res.body.data).toHaveProperty('newCustomers');
    });
  });
});
