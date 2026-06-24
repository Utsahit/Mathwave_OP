import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { getRedisClient, disconnectRedis } from '../src/config/redis';
import { disconnectPrisma } from '../src/config/prisma';
import { env } from '../src/config/env';

jest.setTimeout(30000);

describe('Authentication, Sessions, and RBAC Integration Suite', () => {
  let customerEmail: string;
  let adminEmail: string;
  let testPassword = 'Password123!';

  beforeAll(async () => {
    console.log('TEST DATABASE_URL:', env.DATABASE_URL);
    console.log('TEST REDIS_URL:', env.REDIS_URL);
    // Generate unique email targets to prevent conflicts
    const uniqueId = Date.now();
    customerEmail = `customer_${uniqueId}@elixirandoak.in`;
    adminEmail = `admin_${uniqueId}@elixirandoak.in`;

    // Clear failed attempts or lockout keys in Redis from previous runs
    const redis = getRedisClient();
    if (redis.status === 'ready') {
      await redis.flushall();
    }
  });

  afterAll(async () => {
    // Cleanup created users
    await prisma.userSession.deleteMany({
      where: {
        user: {
          email: { in: [customerEmail, adminEmail, customerEmail.toLowerCase()] },
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        email: { in: [customerEmail, adminEmail, customerEmail.toLowerCase()] },
      },
    });

    // Close resource drivers cleanly to prevent Jest open handles warnings
    await disconnectRedis();
    await disconnectPrisma();
  });

  describe('1. Registration Flow', () => {
    it('should register a new customer user successfully with default CUSTOMER role', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: customerEmail,
        password: testPassword,
        name: 'Integration Test Customer',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(customerEmail.toLowerCase());
      expect(res.body.data.user.role).toBe('CUSTOMER');
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it('should reject registration if the email is already registered (case-insensitive)', async () => {
      // Trying case-varied duplicate email
      const mixedEmail = customerEmail.toUpperCase();
      const res = await request(app).post('/api/v1/auth/register').send({
        email: mixedEmail,
        password: testPassword,
        name: 'Duplicate Register',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('DUPLICATE_EMAIL');
    });

    it('should reject registration if password fails complexity strength validation', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'weakpass@elixirandoak.in',
        password: 'simple',
        name: 'Weak Pass User',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('2. Login and Account Lockout Flow', () => {
    it('should login successfully with normalized case-insensitive email', async () => {
      const mixedEmail = customerEmail.toUpperCase();
      const res = await request(app).post('/api/v1/auth/login').send({
        email: mixedEmail,
        password: testPassword,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it('should track failed attempts and lock account after 5 consecutive failures', async () => {
      const fakeEmail = `failed_user_${Date.now()}@elixirandoak.in`;

      // Pre-register user to verify lockout on registered accounts
      await request(app).post('/api/v1/auth/register').send({
        email: fakeEmail,
        password: testPassword,
        name: 'Failed Login Mock User',
      });

      // 5 consecutive failed login attempts
      for (let i = 0; i < 5; i++) {
        const failedRes = await request(app).post('/api/v1/auth/login').send({
          email: fakeEmail,
          password: 'WrongPassword123!',
        });
        expect(failedRes.status).toBe(401);
      }

      // The 6th attempt should be blocked by lockout protection
      const lockedRes = await request(app).post('/api/v1/auth/login').send({
        email: fakeEmail,
        password: testPassword, // Correct password but account is locked
      });

      expect(lockedRes.status).toBe(403);
      expect(lockedRes.body.success).toBe(false);
      expect(lockedRes.body.code).toBe('ACCOUNT_LOCKED');
    });
  });

  describe('3. Token Rotation and Replay Hijack Protection', () => {
    it('should rotate access and refresh tokens correctly', async () => {
      // 1. Login to get tokens
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: customerEmail,
        password: testPassword,
      });

      const oldRefresh = loginRes.body.data.refreshToken;

      // 2. Rotate token
      const rotateRes = await request(app).post('/api/v1/auth/refresh').send({
        refreshToken: oldRefresh,
      });

      expect(rotateRes.status).toBe(200);
      expect(rotateRes.body.success).toBe(true);
      expect(rotateRes.body.data.accessToken).toBeDefined();
      expect(rotateRes.body.data.refreshToken).toBeDefined();
    });

    it('should detect token replay and revoke all sessions upon reuse attempt', async () => {
      // 1. Login
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: customerEmail,
        password: testPassword,
      });

      const oldRefresh = loginRes.body.data.refreshToken;

      // 2. First Rotate (valid)
      const rotate1 = await request(app).post('/api/v1/auth/refresh').send({
        refreshToken: oldRefresh,
      });

      expect(rotate1.status).toBe(200);
      const newRefresh = rotate1.body.data.refreshToken;

      // 3. Second Rotate using oldRefresh (Replay Attack!)
      const rotate2 = await request(app).post('/api/v1/auth/refresh').send({
        refreshToken: oldRefresh,
      });

      expect(rotate2.status).toBe(401);
      expect(rotate2.body.code).toBe('REPLAY_ATTACK_DETECTED');

      // 4. Verify that newRefresh has also been invalidated (sessions revoked)
      const rotate3 = await request(app).post('/api/v1/auth/refresh').send({
        refreshToken: newRefresh,
      });

      expect(rotate3.status).toBe(401);
    });
  });

  describe('4. Logout and Session Lifecycles', () => {
    it('should log out from current session only', async () => {
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: customerEmail,
        password: testPassword,
      });

      const { accessToken, refreshToken } = loginRes.body.data;

      // Access profile (must succeed)
      const meBefore = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(meBefore.status).toBe(200);

      // Logout session
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken });
      expect(logoutRes.status).toBe(200);

      // Refreshing using logged out token must fail
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });
      expect(refreshRes.status).toBe(401);
    });

    it('should log out from all sessions', async () => {
      // 1. Session 1
      const s1 = await request(app).post('/api/v1/auth/login').send({
        email: customerEmail,
        password: testPassword,
      });
      const s1Access = s1.body.data.accessToken;

      // 2. Session 2
      const s2 = await request(app).post('/api/v1/auth/login').send({
        email: customerEmail,
        password: testPassword,
      });
      const s2Access = s2.body.data.accessToken;

      // 3. Trigger Logout All from Session 1
      const logoutAllRes = await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${s1Access}`);
      expect(logoutAllRes.status).toBe(200);

      // 4. Verify Session 2 is now also unauthorized
      const meS2 = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${s2Access}`);
      expect(meS2.status).toBe(401);
    });
  });

  describe('5. Profile and RBAC Middlewares Check', () => {
    it('should return profile, default role, and live permission arrays', async () => {
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: customerEmail,
        password: testPassword,
      });
      const accessToken = loginRes.body.data.accessToken;

      const profileRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(profileRes.status).toBe(200);
      expect(profileRes.body.data.role).toBe('CUSTOMER');
      expect(profileRes.body.data.permissions).toBeInstanceOf(Array);
    });
  });

  describe('6. Change Password Flow', () => {
    it('should change user password and invalidate old active sessions', async () => {
      // 1. Login
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: customerEmail,
        password: testPassword,
      });
      const oldAccess = loginRes.body.data.accessToken;

      // 2. Change password
      const newPassword = 'NewSecurePassword123!';
      const changeRes = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${oldAccess}`)
        .send({
          oldPassword: testPassword,
          newPassword,
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.data.accessToken).toBeDefined();

      const newAccess = changeRes.body.data.accessToken;
      testPassword = newPassword; // Update testPassword reference for subsequent teardown logins

      // 3. Old access token must be invalidated (sessions revoked)
      const oldProfile = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${oldAccess}`);
      expect(oldProfile.status).toBe(401);

      // 4. New access token must succeed
      const newProfile = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${newAccess}`);
      expect(newProfile.status).toBe(200);
    });
  });
});
