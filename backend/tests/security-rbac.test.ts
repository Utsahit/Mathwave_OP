import request from 'supertest';
import app from '../src/app';
import { disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(120000);

describe('RBAC Penetration Tests', () => {
  let customerToken: string;
  let staffToken: string;
  let adminToken: string;
  let tamperedToken: string;
  const expiredToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiZW1haWwiOiJ0ZXN0QHRlc3QuY29tIiwicm9sZU5hbWUiOiJBRE1JTiIsImlhdCI6MTUxNjIzOTAyMiwiZXhwIjoxNTE2MjM5MDIyfQ.test';

  beforeAll(async () => {
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

    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@elixirandoak.in',
      password: 'Password123!',
    });
    adminToken = adminLogin.body.data.accessToken;

    tamperedToken = adminToken ? adminToken.slice(0, -5) + 'tamper' : 'tampered';
  });

  afterAll(async () => {
    await disconnectPrisma();
    await disconnectRedis();
  });

  describe('A01 — Authentication Token Validation', () => {
    it('should reject request with missing auth header', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('should reject request with empty Bearer token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer ');
      expect(res.status).toBe(401);
    });

    it('should reject request with tampered token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`);
      expect(res.status).toBe(401);
    });

    it('should reject request with expired/malformed token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
    });

    it('should reject request with invalid Bearer prefix', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Basic ${adminToken}`);
      expect(res.status).toBe(401);
    });
  });

  describe('A02 — CUSTOMER Isolation', () => {
    it('customer cannot access admin audit logs', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('customer cannot access admin jobs', async () => {
      const res = await request(app)
        .get('/api/v1/admin/jobs')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('customer cannot access admin reports', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('customer cannot access admin giftcards', async () => {
      const res = await request(app)
        .get('/api/v1/admin/giftcards')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('customer cannot access kitchen tickets', async () => {
      const res = await request(app)
        .get('/api/v1/kitchen/tickets')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('customer cannot access support admin list', async () => {
      const res = await request(app)
        .get('/api/v1/support/admin')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('customer cannot access campaigns list', async () => {
      const res = await request(app)
        .get('/api/v1/campaigns')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('customer cannot recalculate segments', async () => {
      const res = await request(app)
        .post('/api/v1/segments/recalculate')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('customer cannot access security dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/admin/security/dashboard')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('A03 — STAFF Isolation', () => {
    it('staff cannot access admin audit logs', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(403);
    });

    it('staff cannot access admin jobs', async () => {
      const res = await request(app)
        .get('/api/v1/admin/jobs')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(403);
    });

    it('staff cannot access admin reports', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(403);
    });

    it('staff cannot access giftcards', async () => {
      const res = await request(app)
        .get('/api/v1/admin/giftcards')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(403);
    });

    it('staff cannot create campaigns', async () => {
      const res = await request(app)
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'test', type: 'EMAIL' });
      expect(res.status).toBe(403);
    });

    it('staff cannot recalculate segments', async () => {
      const res = await request(app)
        .post('/api/v1/segments/recalculate')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(403);
    });

    it('staff cannot access security dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/admin/security/dashboard')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('A04 — ADMIN Access Validation', () => {
    it('admin can access audit logs', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('admin can access security dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/admin/security/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('admin can access campaigns', async () => {
      const res = await request(app)
        .get('/api/v1/campaigns')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('admin can access segments', async () => {
      const res = await request(app)
        .get('/api/v1/segments')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('admin can access marketing automations', async () => {
      const res = await request(app)
        .get('/api/v1/marketing/automations')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('A05 — Unauthenticated Access', () => {
    it('should reject unauthenticated menu create', async () => {
      const res = await request(app)
        .post('/api/v1/menu/categories')
        .send({ name: 'x', slug: 'x' });
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated order list', async () => {
      const res = await request(app).get('/api/v1/orders/admin/list');
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated analytics', async () => {
      const res = await request(app).get('/api/v1/analytics/dashboard');
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated inventory access', async () => {
      const res = await request(app).get('/api/v1/inventory');
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated kitchen access', async () => {
      const res = await request(app).get('/api/v1/kitchen/tickets');
      expect(res.status).toBe(401);
    });
  });
});
