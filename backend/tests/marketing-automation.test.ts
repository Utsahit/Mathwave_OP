import app from '../src/app';
import request from 'supertest';
import { prisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Marketing Automation API Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let automationId: string;

  beforeAll(async () => {
    const adminRes = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@elixirandoak.in',
      password: 'Password123!',
    });
    adminToken = adminRes.body.data?.accessToken || adminRes.body.accessToken;

    const custRes = await request(app).post('/api/v1/auth/login').send({
      email: 'customer@elixirandoak.in',
      password: 'Password123!',
    });
    customerToken = custRes.body.data?.accessToken || custRes.body.accessToken;
  });

  afterAll(async () => {
    if (automationId) {
      await prisma.marketingAutomation
        .delete({ where: { id: automationId } })
        .catch(() => {});
    }
    await disconnectRedis();
  });

  describe('POST /api/v1/marketing/automations', () => {
    it('should create an automation', async () => {
      const res = await request(app)
        .post('/api/v1/marketing/automations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Birthday Reward', trigger: 'BIRTHDAY' });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Birthday Reward');
      automationId = res.body.data.id;
    });

    it('should reject CUSTOMER from creating automations', async () => {
      const res = await request(app)
        .post('/api/v1/marketing/automations')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Test', trigger: 'BIRTHDAY' });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/marketing/automations', () => {
    it('should list automations', async () => {
      const res = await request(app)
        .get('/api/v1/marketing/automations')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should reject CUSTOMER from viewing automations', async () => {
      const res = await request(app)
        .get('/api/v1/marketing/automations')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/v1/marketing/automations/:id', () => {
    it('should update an automation', async () => {
      const res = await request(app)
        .put(`/api/v1/marketing/automations/${automationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Birthday Reward Updated' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Birthday Reward Updated');
    });
  });
});
