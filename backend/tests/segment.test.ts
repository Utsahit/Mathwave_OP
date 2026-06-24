import app from '../src/app';
import request from 'supertest';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Segment API Integration Tests', () => {
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

  describe('POST /api/v1/segments/recalculate', () => {
    it('should recalculate segments', async () => {
      const res = await request(app)
        .post('/api/v1/segments/recalculate')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('assigned');
    });

    it('should reject CUSTOMER from recalculating segments', async () => {
      const res = await request(app)
        .post('/api/v1/segments/recalculate')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/segments/my', () => {
    it('should return user segments', async () => {
      const res = await request(app)
        .get('/api/v1/segments/my')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/segments/stats', () => {
    it('should return segment stats', async () => {
      const res = await request(app)
        .get('/api/v1/segments/stats')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.data).toBe('object');
    });
  });

  describe('GET /api/v1/segments', () => {
    it('should list segments', async () => {
      const res = await request(app)
        .get('/api/v1/segments')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/segments');
      expect(res.status).toBe(401);
    });
  });
});
