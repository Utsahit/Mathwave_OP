import app from '../src/app';
import request from 'supertest';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Marketing Analytics API Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;

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
    await disconnectRedis();
  });

  describe('GET /api/v1/analytics/marketing', () => {
    it('should return marketing analytics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/marketing')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('totalCampaigns');
      expect(res.body.data).toHaveProperty('campaignDeliveryRate');
      expect(res.body.data).toHaveProperty('campaignOpenRate');
      expect(res.body.data).toHaveProperty('campaignClickRate');
      expect(res.body.data).toHaveProperty('totalVIP');
      expect(res.body.data).toHaveProperty('churnRate');
      expect(res.body.data).toHaveProperty('retentionRate');
    });

    it('should reject CUSTOMER from viewing marketing analytics', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/marketing')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/analytics/marketing');
      expect(res.status).toBe(401);
    });
  });
});
