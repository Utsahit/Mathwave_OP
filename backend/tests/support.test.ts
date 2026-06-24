import request from 'supertest';
import app from '../src/app';
import { disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Support Ticket API Integration Tests', () => {
  let customerToken: string;
  let adminToken: string;
  let ticketId: string;

  beforeAll(async () => {
    const customerLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'customer@elixirandoak.in',
      password: 'Password123!',
    });
    customerToken = customerLogin.body.data.accessToken;

    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@elixirandoak.in',
      password: 'Password123!',
    });
    adminToken = adminLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await disconnectPrisma();
    await disconnectRedis();
  });

  describe('POST /api/v1/support', () => {
    it('should create a support ticket', async () => {
      const res = await request(app)
        .post('/api/v1/support')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ subject: 'Test Issue', message: 'This is a test support ticket.' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      ticketId = res.body.data.id;
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/v1/support')
        .send({ subject: 'Test', message: 'Test message' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/support/my', () => {
    it('should list own tickets', async () => {
      const res = await request(app)
        .get('/api/v1/support/my')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/support/my');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/support/admin', () => {
    it('should list all tickets for admin', async () => {
      const res = await request(app)
        .get('/api/v1/support/admin')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject non-admin users', async () => {
      const res = await request(app)
        .get('/api/v1/support/admin')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/v1/support/admin/:id/status', () => {
    it('should update ticket status', async () => {
      const res = await request(app)
        .put(`/api/v1/support/admin/${ticketId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'IN_PROGRESS' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('IN_PROGRESS');
    });

    it('should reject invalid transitions', async () => {
      const res = await request(app)
        .put(`/api/v1/support/admin/${ticketId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'OPEN' });
      expect(res.status).toBe(422);
    });
  });
});
