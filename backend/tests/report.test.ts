import request from 'supertest';
import app from '../src/app';
import { disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Report & Export API Integration Tests', () => {
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

  describe('Scheduled Reports CRUD', () => {
    let reportId: string;

    it('should list scheduled reports', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should create a new scheduled report', async () => {
      const res = await request(app)
        .post('/api/v1/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Report', email: 'test@example.com', frequency: 'WEEKLY' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe('Test Report');
      expect(res.body.data.frequency).toBe('WEEKLY');
      reportId = res.body.data.id;
    });

    it('should reject creating report without required fields', async () => {
      const res = await request(app)
        .post('/api/v1/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Incomplete' });
      expect(res.status).toBe(400);
    });

    it('should reject creating report with invalid frequency', async () => {
      const res = await request(app)
        .post('/api/v1/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Bad', email: 'x@x.com', frequency: 'YEARLY' });
      expect(res.status).toBe(400);
    });

    it('should delete a scheduled report', async () => {
      if (!reportId) return;
      const res = await request(app)
        .delete(`/api/v1/admin/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('CSV Export', () => {
    it('should export revenue CSV', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/export/csv?type=revenue')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
    });

    it('should export orders CSV', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/export/csv?type=orders')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });

    it('should export customers CSV', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/export/csv?type=customers')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });

    it('should export inventory CSV', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/export/csv?type=inventory')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });

    it('should export branches CSV', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/export/csv?type=branches')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });

    it('should reject invalid export type', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/export/csv?type=invalid')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });

    it('should reject CUSTOMER from CSV export', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/export/csv?type=revenue')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('PDF Export', () => {
    it('should queue PDF export', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/export/pdf')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('jobId');
      expect(res.body.data).toHaveProperty('type');
    });

    it('should queue PDF export with custom type', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/export/pdf?type=monthly-summary')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.type).toBe('monthly-summary');
    });

    it('should reject unauthenticated PDF export', async () => {
      const res = await request(app).get('/api/v1/admin/reports/export/pdf');
      expect(res.status).toBe(401);
    });
  });

  describe('RBAC', () => {
    it('should reject CUSTOMER from viewing reports', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('should reject CUSTOMER from creating reports', async () => {
      const res = await request(app)
        .post('/api/v1/admin/reports')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Test', email: 't@x.com', frequency: 'DAILY' });
      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated access', async () => {
      const res = await request(app).get('/api/v1/admin/reports');
      expect(res.status).toBe(401);
    });
  });
});
