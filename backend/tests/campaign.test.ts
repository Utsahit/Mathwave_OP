import app from '../src/app';
import request from 'supertest';
import { prisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Campaign API Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let campaignId: string;

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
    if (campaignId) {
      await prisma.campaignRecipient
        .deleteMany({ where: { campaignId } })
        .catch(() => {});
      await prisma.marketingCampaign
        .delete({ where: { id: campaignId } })
        .catch(() => {});
    }
    await disconnectRedis();
  });

  describe('POST /api/v1/campaigns', () => {
    it('should create a campaign', async () => {
      const res = await request(app)
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Summer Sale',
          type: 'EMAIL',
          subject: 'Summer Specials',
          content: '<h1>Summer Sale!</h1><p>Hi {{name}}, enjoy our summer specials.</p>',
        });
      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.name).toBe('Summer Sale');
      campaignId = res.body.data.id;
    });

    it('should reject CUSTOMER from creating campaigns', async () => {
      const res = await request(app)
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Test', type: 'EMAIL', content: 'test' });
      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/v1/campaigns')
        .send({ name: 'Test', type: 'EMAIL', content: 'test' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/campaigns', () => {
    it('should list campaigns', async () => {
      const res = await request(app)
        .get('/api/v1/campaigns')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/campaigns/:id', () => {
    it('should get a campaign by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(campaignId);
    });
  });

  describe('PUT /api/v1/campaigns/:id', () => {
    it('should update a campaign', async () => {
      const res = await request(app)
        .put(`/api/v1/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Summer Sale Updated' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Summer Sale Updated');
    });
  });

  describe('POST /api/v1/campaigns/:id/start', () => {
    it('should start a campaign', async () => {
      const res = await request(app)
        .post(`/api/v1/campaigns/${campaignId}/start`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('RUNNING');
    });
  });

  describe('POST /api/v1/campaigns/:id/cancel', () => {
    it('should cancel a running campaign', async () => {
      const res = await request(app)
        .post(`/api/v1/campaigns/${campaignId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
    });
  });

  describe('GET /api/v1/campaigns/:id/analytics', () => {
    it('should return campaign analytics', async () => {
      const res = await request(app)
        .get(`/api/v1/campaigns/${campaignId}/analytics`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('deliveryRate');
      expect(res.body.data).toHaveProperty('openRate');
    });
  });

  describe('DELETE /api/v1/campaigns/:id', () => {
    it('should delete a cancelled campaign', async () => {
      const res = await request(app)
        .delete(`/api/v1/campaigns/${campaignId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      campaignId = '';
    });
  });
});
