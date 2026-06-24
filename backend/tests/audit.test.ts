import request from 'supertest';
import app from '../src/app';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Audit Log API Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let staffToken: string;

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

  describe('List Audit Logs', () => {
    it('should list audit logs with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter by entityType', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit?entityType=Order')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('RBAC', () => {
    it('should reject STAFF role from viewing audit logs', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject CUSTOMER role from viewing audit logs', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/admin/audit');
      expect(res.status).toBe(401);
    });
  });

  describe('Audit Service Unit Tests', () => {
    it('should create audit log via service', async () => {
      const { auditService } = await import('../src/services/audit.service');
      const log = await auditService.logCreate(null, 'Test', 'test-id', { key: 'value' });
      expect(log).toHaveProperty('id');
      expect(log.action).toBe('CREATE');
      expect(log.entityType).toBe('Test');

      await prisma.auditLog.delete({ where: { id: log.id } });
    });

    it('should log status change via service', async () => {
      const { auditService } = await import('../src/services/audit.service');
      const log = await auditService.logStatusChange(
        null,
        'Order',
        'test-id',
        'PENDING',
        'CONFIRMED'
      );
      expect(log.action).toBe('STATUS_CHANGE');

      await prisma.auditLog.delete({ where: { id: log.id } });
    });
  });
});
