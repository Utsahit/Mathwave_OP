import request from 'supertest';
import app from '../src/app';
import { prisma, disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Referral API Integration Tests', () => {
  let adminToken: string;
  let secondCustomerId: string;
  let testReferralId: string;

  beforeAll(async () => {
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@elixirandoak.in',
      password: 'Password123!',
    });
    adminToken = adminLogin.body.data.accessToken;

    // Create a second customer user for referral tests
    const staffLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'staff@elixirandoak.in',
      password: 'Password123!',
    });
    secondCustomerId = staffLogin.body.data.user.id;
  });

  afterAll(async () => {
    if (testReferralId) {
      await prisma.referral.deleteMany({ where: { id: testReferralId } }).catch(() => {});
    }
    await disconnectPrisma();
    await disconnectRedis();
  });

  describe('POST /api/v1/referrals (create)', () => {
    it('should create a referral', async () => {
      const res = await request(app)
        .post('/api/v1/referrals')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ referredUserId: secondCustomerId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      testReferralId = res.body.data.id;
    });

    it('should reject duplicate referral', async () => {
      const res = await request(app)
        .post('/api/v1/referrals')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ referredUserId: secondCustomerId });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DUPLICATE_REFERRAL');
    });

    it('should reject self-referral', async () => {
      const adminUser = await prisma.user.findUnique({
        where: { email: 'admin@elixirandoak.in' },
        select: { id: true },
      });
      const adminId = adminUser!.id;

      const res = await request(app)
        .post('/api/v1/referrals')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ referredUserId: adminId });

      expect(res.status).toBe(400);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/v1/referrals')
        .send({ referredUserId: secondCustomerId });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/referrals (list)', () => {
    it('should list referrals for authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/referrals')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('data');
    });
  });

  describe('POST /api/v1/referrals/:id/grant-bonus', () => {
    it('should grant referral bonus', async () => {
      const res = await request(app)
        .post(`/api/v1/referrals/${testReferralId}/grant-bonus`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject duplicate bonus grant', async () => {
      const res = await request(app)
        .post(`/api/v1/referrals/${testReferralId}/grant-bonus`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('REWARD_ALREADY_GRANTED');
    });
  });
});
