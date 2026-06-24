import request from 'supertest';
import app from '../src/app';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';
import { queueService } from '../src/services/queue.service';

jest.setTimeout(30000);

describe('Job Queue API Integration Tests', () => {
  let adminToken: string;
  let staffToken: string;
  let customerToken: string;
  let testJobId: string;

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

    const job = await queueService.enqueue('TEST_JOB', { test: true });
    testJobId = job.id;
  });

  afterAll(async () => {
    await prisma.jobQueue.deleteMany({ where: { type: 'TEST_JOB' } });
    await disconnectPrisma();
    await disconnectRedis();
  });

  describe('List Jobs', () => {
    it('should list jobs with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/admin/jobs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Job Stats', () => {
    it('should return job stats', async () => {
      const res = await request(app)
        .get('/api/v1/admin/jobs/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('pending');
      expect(res.body.data).toHaveProperty('total');
    });
  });

  describe('Retry Failed Job', () => {
    it('should return 404 for non-existent job retry', async () => {
      const res = await request(app)
        .post('/api/v1/admin/jobs/non-existent-id/retry')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('RBAC', () => {
    it('should reject STAFF role from viewing jobs', async () => {
      const res = await request(app)
        .get('/api/v1/admin/jobs')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject CUSTOMER role from viewing jobs', async () => {
      const res = await request(app)
        .get('/api/v1/admin/jobs')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject CUSTOMER role from retrying jobs', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/jobs/${testJobId}/retry`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Queue Service Unit Tests', () => {
    it('should enqueue a job', async () => {
      const job = await queueService.enqueue('TEST_UNIT', { msg: 'hello' });
      expect(job).toHaveProperty('id');
      expect(job.status).toBe('PENDING');

      await prisma.jobQueue.delete({ where: { id: job.id } });
    });

    it('should process a pending job', async () => {
      const job = await queueService.enqueue('TEST_PROCESS', { msg: 'process' });
      const result = await queueService.processJob(job.id);
      expect(result).not.toBeNull();
      if (result && 'processedAt' in result) {
        expect(result.status).toBe('COMPLETED');
        expect(result.processedAt).not.toBeNull();
      }

      await prisma.jobQueue.delete({ where: { id: job.id } });
    });

    it('should handle job failure gracefully with retry', async () => {
      const job = await queueService.enqueue('UNKNOWN_TYPE', {});
      const result = await queueService.processJob(job.id);
      expect(result).not.toBeNull();
      if (result && 'lastError' in result) {
        expect(result.status).toBe('PENDING');
        expect(result.lastError).toBeTruthy();
        expect(result.attempts).toBe(1);
      }

      await prisma.jobQueue.delete({ where: { id: job.id } });
    });
  });

  describe('Scheduler Service', () => {
    it('should run low stock check without error', async () => {
      const { schedulerService } = await import('../src/services/scheduler.service');
      await expect(schedulerService.runLowStockCheckNow()).resolves.not.toThrow();
    });

    it('should run guest cart cleanup without error', async () => {
      const { schedulerService } = await import('../src/services/scheduler.service');
      await expect(schedulerService.runGuestCartCleanupNow()).resolves.not.toThrow();
    });
  });
});
