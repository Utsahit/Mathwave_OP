import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { getRedisClient, disconnectRedis } from '../src/config/redis';
import { disconnectPrisma } from '../src/config/prisma';

jest.setTimeout(30000);

describe('Phase 7 — Reviews & Customer Feedback Integration Suite', () => {
  let adminToken: string;
  let customerToken: string;

  let testReviewId: string;
  const spamEmail = `spam-${Date.now()}@test.com`;

  beforeAll(async () => {
    // Clear Redis rate limit keys to avoid 429 rate limiting from previous runs
    const reviewRedis = getRedisClient();
    if (reviewRedis.status === 'ready') {
      try {
        const keys = await reviewRedis.keys('review:rate:*');
        if (keys.length > 0) {
          await reviewRedis.del(...keys);
        }
      } catch (err) {
        console.warn('Failed to clear redis review rate limit keys:', err);
      }
    }

    // Login Admin
    const adminRes = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@elixirandoak.in',
      password: 'Password123!',
    });
    adminToken = adminRes.body.data.accessToken;

    // Login Customer
    const customerRes = await request(app).post('/api/v1/auth/login').send({
      email: 'customer@elixirandoak.in',
      password: 'Password123!',
    });
    customerToken = customerRes.body.data.accessToken;
  });

  afterAll(async () => {
    // Cleanup created reviews
    await prisma.review.deleteMany({
      where: {
        OR: [
          { email: { startsWith: 'spam-' } },
          { email: 'tester@elixirandoak.in' },
          { comment: { contains: 'TEST_REVIEW_PHASE_7' } },
        ],
      },
    });

    await disconnectRedis();
    await disconnectPrisma();
  });

  // ── 1. PUBLIC SUBMISSION & VALIDATION ────────────────────────────────────────

  describe('1. Public Review Submission', () => {
    it('should submit a valid review (201, pending moderation)', async () => {
      const res = await request(app).post('/api/v1/reviews').send({
        name: 'Test Reviewer',
        email: 'tester@elixirandoak.in',
        title: 'TEST_REVIEW_PHASE_7 Excellent food',
        rating: 5,
        comment: 'The service was absolutely amazing, highly recommend!',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isApproved).toBe(false);
      expect(res.body.data.isFeatured).toBe(false);
      expect(res.body.data.rating).toBe(5);
      testReviewId = res.body.data.id;
    });

    it('should reject validation errors (400)', async () => {
      const res = await request(app).post('/api/v1/reviews').send({
        name: 'T',
        email: 'bad-email',
        rating: 6,
        comment: 'Short',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should detect profanity and reject submission (422)', async () => {
      const res = await request(app)
        .post('/api/v1/reviews')
        .send({
          name: 'Bad Customer',
          email: `tester-${Date.now()}@elixirandoak.in`,
          rating: 1,
          comment: 'This place is total crap and trash food!',
        });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('PROFANITY_DETECTED');
    });

    it('should trigger email cooldown on consecutive reviews (429)', async () => {
      // First review
      await request(app).post('/api/v1/reviews').send({
        name: 'Spammer',
        email: spamEmail,
        rating: 4,
        comment: 'TEST_REVIEW_PHASE_7 First review comment here.',
      });

      // Clear IP rate limit key to let it bypass IP rate limit and reach email cooldown
      const reviewRedis2 = getRedisClient();
      if (reviewRedis2.status === 'ready') {
        const keys = await reviewRedis2.keys('review:rate:*');
        if (keys.length > 0) {
          await reviewRedis2.del(...keys);
        }
      }

      // Immediate second review
      const res = await request(app).post('/api/v1/reviews').send({
        name: 'Spammer',
        email: spamEmail,
        rating: 4,
        comment: 'TEST_REVIEW_PHASE_7 Second review comment here.',
      });

      expect(res.status).toBe(429);
      expect(res.body.code).toBe('EMAIL_COOLDOWN');
    });
  });

  // ── 2. ADMIN LIST & MODERATION ───────────────────────────────────────────────

  describe('2. Admin List & Moderation', () => {
    it('should list reviews for admin/manager (200)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reviews')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ search: 'TEST_REVIEW_PHASE_7' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should block customer from listing admin reviews (403)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reviews')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('should approve a review (200)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/reviews/${testReviewId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isApproved).toBe(true);
    });

    it('should feature an approved review (200)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/reviews/${testReviewId}/feature`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isFeatured).toBe(true);
    });

    it('should prevent featuring a non-approved review (422)', async () => {
      // First unapprove it
      await request(app)
        .put(`/api/v1/admin/reviews/${testReviewId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .put(`/api/v1/admin/reviews/${testReviewId}/feature`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('REVIEW_NOT_APPROVED');
    });
  });

  // ── 3. CACHING & STATS ───────────────────────────────────────────────────────

  describe('3. Caching & Public Endpoints', () => {
    beforeAll(async () => {
      // Ensure the test review is approved for stats and listing
      await request(app)
        .put(`/api/v1/admin/reviews/${testReviewId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
    });

    it('should fetch public reviews listing (200)', async () => {
      const res = await request(app).get('/api/v1/reviews').query({ page: 1, limit: 10 });
      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
    });

    it('should fetch review statistics (200)', async () => {
      const res = await request(app).get('/api/v1/reviews/stats');
      expect(res.status).toBe(200);
      expect(res.body.data.averageRating).toBeDefined();
      expect(res.body.data.totalReviews).toBeGreaterThanOrEqual(1);
    });
  });
});
