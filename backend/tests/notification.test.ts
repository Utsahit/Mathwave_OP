import request from 'supertest';
import app from '../src/app';
import { disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Notification API Integration Tests', () => {
  let adminToken: string;
  let staffToken: string;
  let customerToken: string;

  beforeAll(async () => {
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@elixirandoak.in',
      password: 'Password123!',
    });
    adminToken = adminLogin.body.data.accessToken;

    const staffLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'staff@elixirandoak.in',
      password: 'Password123!',
    });
    staffToken = staffLogin.body.data.accessToken;

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

  describe('List Notifications', () => {
    it('should list notifications for authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/notifications');
      expect(res.status).toBe(401);
    });
  });

  describe('Unread Count', () => {
    it('should return unread count', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('count');
      expect(typeof res.body.data.count).toBe('number');
    });
  });

  describe('Preferences', () => {
    it('should get notification preferences', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('orderUpdates');
      expect(res.body.data).toHaveProperty('reservationUpdates');
      expect(res.body.data).toHaveProperty('marketingEmails');
    });

    it('should update notification preferences', async () => {
      const res = await request(app)
        .put('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ marketingEmails: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.marketingEmails).toBe(false);
    });

    it('should reject CUSTOMER role from updating preferences', async () => {
      const res = await request(app)
        .put('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ marketingEmails: false });

      expect(res.status).toBe(403);
    });
  });

  describe('Mark as Read', () => {
    it('should mark all notifications as read', async () => {
      const res = await request(app)
        .put('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('RBAC', () => {
    it('should allow STAFF to view notifications', async () => {
      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
    });

    it('should reject CUSTOMER role from viewing notifications', async () => {
      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
