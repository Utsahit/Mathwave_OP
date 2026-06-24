import request from 'supertest';
import app from '../src/app';
import { disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('SQL Injection Protection Tests', () => {
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

  const injectPayloads = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "' UNION SELECT * FROM users --",
    '1; SELECT * FROM admin_users --',
    "' OR 1=1 --",
    "admin'--",
    "'; DELETE FROM orders; --",
    "' WAITFOR DELAY '00:00:05' --",
    "1' AND 1=1 --",
    '\' OR "a"="a',
    "\\' OR 1=1 --",
    '${7*7}',
    '<script>alert(1)</script>',
    '%27 OR %271%27=%271',
    "` OR '1'='1",
  ];

  describe('Search and Filter Endpoints', () => {
    it('should protect menu search from SQL injection', async () => {
      for (const payload of injectPayloads) {
        const res = await request(app)
          .get(`/api/v1/menu/items?search=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${customerToken}`);
        expect(res.status).toBeLessThan(500);
        expect(res.body.success).toBeDefined();
      }
    });

    it('should protect order search from SQL injection', async () => {
      for (const payload of injectPayloads.slice(0, 5)) {
        const res = await request(app)
          .get(`/api/v1/orders/admin/list?search=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBeLessThan(500);
      }
    });

    it('should protect menu filter parameters from SQL injection', async () => {
      for (const payload of injectPayloads.slice(0, 5)) {
        const res = await request(app)
          .get(
            `/api/v1/menu/items?category=${encodeURIComponent(payload)}&tag=${encodeURIComponent(payload)}`
          )
          .set('Authorization', `Bearer ${customerToken}`);
        expect(res.status).toBeLessThan(500);
      }
    });
  });

  describe('Authentication Endpoints', () => {
    it('should protect login from SQL injection', async () => {
      for (const payload of injectPayloads) {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: `test${payload}@test.com`,
            password: 'Password123!',
          });
        expect(res.status).toBeLessThan(500);
      }
    });

    it('should protect registration from SQL injection', async () => {
      for (const payload of injectPayloads.slice(0, 5)) {
        const res = await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: `sqli_${Date.now()}${payload}@test.com`,
            password: 'Password123!',
            name: `Test${payload}`,
          });
        expect(res.status).toBeLessThan(500);
      }
    });
  });

  describe('CRUD Endpoints', () => {
    it('should protect reservation forms from SQL injection', async () => {
      for (const payload of injectPayloads.slice(0, 3)) {
        const res = await request(app)
          .post('/api/v1/reservations')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            name: `Test${payload}`,
            email: `sqli_res_${Date.now()}@test.com`,
            phone: `99999999${Date.now() % 100}`,
            date: '2026-12-25',
            timeSlot: '19:00',
            guests: 2,
          });
        expect(res.status).toBeLessThan(500);
      }
    });

    it('should protect contact forms from SQL injection', async () => {
      for (const payload of injectPayloads.slice(0, 3)) {
        const res = await request(app)
          .post('/api/v1/contact')
          .send({
            name: `Test${payload}`,
            email: `sqli_contact_${Date.now()}@test.com`,
            subject: `Test${payload}`,
            message: `Test message ${payload}`,
          });
        expect(res.status).toBeLessThan(500);
      }
    });

    it('should protect reviews from SQL injection', async () => {
      for (const payload of injectPayloads.slice(0, 3)) {
        const res = await request(app)
          .post('/api/v1/reviews')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            name: `Test${payload}`,
            rating: 5,
            comment: `Great food ${payload}`,
          });
        expect(res.status).toBeLessThan(500);
      }
    });
  });

  describe('Analytics Endpoints', () => {
    it('should protect analytics from SQL injection', async () => {
      for (const payload of injectPayloads.slice(0, 3)) {
        const res = await request(app)
          .get(`/api/v1/analytics/dashboard?period=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBeLessThan(500);
      }
    });
  });
});
