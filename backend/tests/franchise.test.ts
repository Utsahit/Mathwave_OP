import request from 'supertest';
import app from '../src/app';
import { prisma, disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Franchise API Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let testFranchiseId: string;
  let testBranchId: string;
  const franchiseCode = `FR${Date.now()}`;
  const branchCode = `FRBR${Date.now()}`;

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
    if (testBranchId) {
      await prisma.branch.deleteMany({ where: { id: testBranchId } }).catch(() => {});
    }
    if (testFranchiseId) {
      await prisma.franchise
        .deleteMany({ where: { id: testFranchiseId } })
        .catch(() => {});
    }
    await disconnectPrisma();
    await disconnectRedis();
  });

  describe('POST /api/v1/franchises (create)', () => {
    it('should allow ADMIN to create franchise', async () => {
      const res = await request(app)
        .post('/api/v1/franchises')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: franchiseCode,
          name: 'Test Franchise',
          ownerName: 'John Owner',
          ownerEmail: 'owner@test.com',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      testFranchiseId = res.body.data.id;
    });

    it('should reject CUSTOMER from creating franchise', async () => {
      const res = await request(app)
        .post('/api/v1/franchises')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          code: 'FAIL',
          name: 'Fail',
          ownerName: 'Fail',
          ownerEmail: 'fail@test.com',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/franchises/assign-branch', () => {
    it('should assign a branch to a franchise', async () => {
      // Create a branch first
      const branchRes = await request(app)
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: branchCode,
          name: 'Franchise Branch',
          address: '456 Franchise Rd',
          city: 'Delhi',
          state: 'Delhi',
          country: 'India',
          timezone: 'Asia/Kolkata',
        });
      testBranchId = branchRes.body.data.id;

      const res = await request(app)
        .post('/api/v1/franchises/assign-branch')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          franchiseId: testFranchiseId,
          branchId: testBranchId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/franchises (list)', () => {
    it('should list franchises', async () => {
      const res = await request(app)
        .get('/api/v1/franchises')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('data');
    });

    it('should reject unauthenticated', async () => {
      const res = await request(app).get('/api/v1/franchises');
      expect(res.status).toBe(401);
    });
  });

  describe('RBAC', () => {
    it('should reject CUSTOMER from viewing franchises', async () => {
      const res = await request(app)
        .get('/api/v1/franchises')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
