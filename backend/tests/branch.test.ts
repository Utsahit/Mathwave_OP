import request from 'supertest';
import app from '../src/app';
import { prisma, disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Branch API Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let staffToken: string;
  let testBranchId: string;
  const testCode = `BR${Date.now()}`;

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

    const staffLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'staff@elixirandoak.in',
      password: 'Password123!',
    });
    staffToken = staffLogin.body.data.accessToken;
  });

  afterAll(async () => {
    if (testBranchId) {
      await prisma.branchStaff
        .deleteMany({ where: { branchId: testBranchId } })
        .catch(() => {});
      await prisma.branch.deleteMany({ where: { id: testBranchId } }).catch(() => {});
    }
    await disconnectPrisma();
    await disconnectRedis();
  });

  describe('POST /api/v1/branches (create)', () => {
    it('should allow ADMIN to create branch', async () => {
      const res = await request(app)
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: testCode,
          name: 'Test Branch',
          address: '123 Test St',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          timezone: 'Asia/Kolkata',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      testBranchId = res.body.data.id;
    });

    it('should reject CUSTOMER from creating branch', async () => {
      const res = await request(app)
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          code: 'FAIL',
          name: 'Fail Branch',
          address: '123 Test',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          timezone: 'Asia/Kolkata',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/branches (list)', () => {
    it('should list branches for authorized user', async () => {
      const res = await request(app)
        .get('/api/v1/branches')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('data');
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/branches');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/branches/:id (get)', () => {
    it('should get a branch by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/branches/${testBranchId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testBranchId);
    });
  });

  describe('PUT /api/v1/branches/:id (update)', () => {
    it('should update a branch', async () => {
      const res = await request(app)
        .put(`/api/v1/branches/${testBranchId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Branch Name' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Branch Name');
    });
  });

  describe('DELETE /api/v1/branches/:id (delete)', () => {
    it('should delete (deactivate) a branch', async () => {
      const res = await request(app)
        .delete(`/api/v1/branches/${testBranchId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });
  });

  describe('RBAC', () => {
    it('should reject CUSTOMER from listing branches', async () => {
      const res = await request(app)
        .get('/api/v1/branches')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow STAFF to view branches', async () => {
      const res = await request(app)
        .get('/api/v1/branches')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
    });
  });
});
