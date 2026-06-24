import request from 'supertest';
import app from '../src/app';
import { disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Favorites API Integration Tests', () => {
  let customerToken: string;
  let menuItemId: string;

  beforeAll(async () => {
    const customerLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'customer@elixirandoak.in',
      password: 'Password123!',
    });
    customerToken = customerLogin.body.data.accessToken;

    const menuRes = await request(app).get('/api/v1/menu/public');
    const items = menuRes.body?.data?.categories?.[0]?.items;
    if (items && items.length > 0) {
      menuItemId = items[0].id;
    }
  });

  afterAll(async () => {
    await disconnectPrisma();
    await disconnectRedis();
  });

  describe('POST /api/v1/favorites/:menuItemId', () => {
    it('should add a favorite', async () => {
      if (!menuItemId) return;
      const res = await request(app)
        .post(`/api/v1/favorites/${menuItemId}`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should reject duplicate favorites', async () => {
      if (!menuItemId) return;
      const res = await request(app)
        .post(`/api/v1/favorites/${menuItemId}`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(409);
    });

    it('should reject unauthenticated requests', async () => {
      if (!menuItemId) return;
      const res = await request(app).post(`/api/v1/favorites/${menuItemId}`);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/favorites', () => {
    it('should list favorites', async () => {
      const res = await request(app)
        .get('/api/v1/favorites')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/favorites');
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/favorites/:menuItemId', () => {
    it('should remove a favorite', async () => {
      if (!menuItemId) return;
      const res = await request(app)
        .delete(`/api/v1/favorites/${menuItemId}`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject removing non-existent favorite', async () => {
      if (!menuItemId) return;
      const res = await request(app)
        .delete(`/api/v1/favorites/${menuItemId}`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(404);
    });
  });
});
