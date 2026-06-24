import request from 'supertest';
import app from '../src/app';
import { disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Address API Integration Tests', () => {
  let customerToken: string;
  let addressId: string;

  beforeAll(async () => {
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

  describe('POST /api/v1/addresses', () => {
    it('should create an address', async () => {
      const res = await request(app)
        .post('/api/v1/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          label: 'Home',
          addressLine1: '123 Main St',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400001',
          isDefault: true,
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.label).toBe('Home');
      addressId = res.body.data.id;
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).post('/api/v1/addresses').send({
        label: 'Home',
        addressLine1: 'Test',
        city: 'Mumbai',
        state: 'MH',
        postalCode: '400001',
      });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/addresses', () => {
    it('should list addresses', async () => {
      const res = await request(app)
        .get('/api/v1/addresses')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('PUT /api/v1/addresses/:id', () => {
    it('should update an address', async () => {
      const res = await request(app)
        .put(`/api/v1/addresses/${addressId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ label: 'Work' });
      expect(res.status).toBe(200);
      expect(res.body.data.label).toBe('Work');
    });

    it('should reject updating non-existent address', async () => {
      const res = await request(app)
        .put('/api/v1/addresses/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ label: 'Test' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/addresses/:id', () => {
    it('should delete an address', async () => {
      const res = await request(app)
        .delete(`/api/v1/addresses/${addressId}`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(200);
    });
  });
});
