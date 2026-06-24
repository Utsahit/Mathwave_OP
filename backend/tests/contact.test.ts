import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { getRedisClient, disconnectRedis } from '../src/config/redis';
import { disconnectPrisma } from '../src/config/prisma';

jest.setTimeout(30000);

describe('Phase 8 — Contact, Newsletter & Communication Integration Suite', () => {
  let adminToken: string;
  let customerToken: string;
  let testMessageId: string;
  let testSubscriberId: string;

  const testEmail = `contact-${Date.now()}@test.com`;
  const spamEmail = `spam-${Date.now()}@test.com`;
  const newsletterEmail = `news-${Date.now()}@test.com`;

  beforeAll(async () => {
    // Clear Redis rate limit keys to avoid 429 rate limiting from previous runs
    const contactRedis = getRedisClient();
    if (contactRedis.status === 'ready') {
      try {
        const keys = await contactRedis.keys('contact:rate:*');
        if (keys.length > 0) {
          await contactRedis.del(...keys);
        }
        await contactRedis.del('contact:stats');
        await contactRedis.del('newsletter:stats');
      } catch (err) {
        console.warn('Failed to clear redis contact keys:', err);
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
    // Cleanup created data
    await prisma.contactMessage.deleteMany({
      where: {
        OR: [
          { email: { startsWith: 'contact-' } },
          { email: { startsWith: 'spam-' } },
          { email: 'tester@elixirandoak.in' },
        ],
      },
    });

    await prisma.newsletterSubscriber.deleteMany({
      where: {
        OR: [{ email: { startsWith: 'news-' } }],
      },
    });

    await disconnectRedis();
    await disconnectPrisma();
  });

  // ── 1. CONTACT FORM SUBMISSION & SPAM PROTECTION ────────────────────────────

  describe('1. Contact Form Submission', () => {
    it('should submit a valid contact message (201)', async () => {
      const res = await request(app).post('/api/v1/contact').send({
        name: 'Test Submitter',
        email: testEmail,
        subject: 'Reservation Inquiry',
        message:
          'Hello, I would like to inquire about reservation options for next Friday.',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isRead).toBe(false);
      expect(res.body.data.isDeleted).toBe(false);
      testMessageId = res.body.data.id;
    });

    it('should reject validation errors (400)', async () => {
      const res = await request(app).post('/api/v1/contact').send({
        name: 'T',
        email: 'bad-email',
        subject: 'Hi',
        message: 'Short',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should detect profanity and reject submission (422)', async () => {
      const res = await request(app)
        .post('/api/v1/contact')
        .send({
          name: 'Aggressive User',
          email: `tester-${Date.now()}@elixirandoak.in`,
          subject: 'This place is crap',
          message: 'Total shit service and food quality!',
        });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('PROFANITY_DETECTED');
    });

    it('should trigger email cooldown on consecutive reviews (429)', async () => {
      // First submission
      await request(app).post('/api/v1/contact').send({
        name: 'Spammer',
        email: spamEmail,
        subject: 'Inquiry 1',
        message: 'This is my first test message inquiry.',
      });

      // Clear IP rate limit key to let it bypass IP rate limit and reach email cooldown
      const contactRedis2 = getRedisClient();
      if (contactRedis2.status === 'ready') {
        const keys = await contactRedis2.keys('contact:rate:*');
        if (keys.length > 0) {
          await contactRedis2.del(...keys);
        }
      }

      // Immediate second submission
      const res = await request(app).post('/api/v1/contact').send({
        name: 'Spammer',
        email: spamEmail,
        subject: 'Inquiry 2',
        message: 'This is my second test message inquiry.',
      });

      expect(res.status).toBe(429);
      expect(res.body.code).toBe('EMAIL_COOLDOWN');
    });

    it('should trigger duplicate message detection (409)', async () => {
      const duplicateEmail = `dup-${Date.now()}@test.com`;

      // Clear IP rate limit keys to allow consecutive submissions
      const contactRedis3 = getRedisClient();
      if (contactRedis3.status === 'ready') {
        const keys = await contactRedis3.keys('contact:rate:*');
        if (keys.length > 0) await contactRedis3.del(...keys);
      }

      // Submit message
      await request(app).post('/api/v1/contact').send({
        name: 'Duplicate Sender',
        email: duplicateEmail,
        subject: 'Unique Subject',
        message: 'This is a unique message body that will be duplicated.',
      });

      // Clear rate limit again to bypass IP rate limits
      if (contactRedis3.status === 'ready') {
        const keys2 = await contactRedis3.keys('contact:rate:*');
        if (keys2.length > 0) await contactRedis3.del(...keys2);
      }
      // Wait to clear the 5min email cooldown in database (since we want to trigger the 10min exact content duplicate instead)
      // Actually, since email cooldown check happens BEFORE duplicate check, to trigger duplicate check we'd have to wait, or bypass email cooldown.
      // Wait, let's bypass email cooldown by submitting with a different email, but then duplicate check compares email too!
      // Since duplicate check matches (email, subject, message), we can't bypass email cooldown unless we change code.
      // But wait! Is duplicate message check code email-specific?
      // Yes, `findRecentMessage(email, subject, message)`.
      // Since email cooldown is 5 minutes, we can verify duplicate message detection in unit tests, or we can just mock it/verify it throws.
      // Let's see: we can adjust the test or we can just verify it by modifying the DB timestamp of the first message to bypass the email cooldown!
      // Yes! We can update the createdAt of the first message to be 6 minutes ago, so it bypasses the 5-min email cooldown, but remains within the 10-min duplicate window!
      // That is an elegant test strategy!
      const msg = await prisma.contactMessage.findFirst({
        where: { email: duplicateEmail },
      });
      if (msg) {
        await prisma.contactMessage.update({
          where: { id: msg.id },
          data: { createdAt: new Date(Date.now() - 6 * 60 * 1000) },
        });
      }

      // Submit identical message
      const res = await request(app).post('/api/v1/contact').send({
        name: 'Duplicate Sender',
        email: duplicateEmail,
        subject: 'Unique Subject',
        message: 'This is a unique message body that will be duplicated.',
      });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DUPLICATE_MESSAGE');
    });
  });

  // ── 2. ADMIN INBOX & MODERATION ──────────────────────────────────────────────

  describe('2. Admin Inbox & Communication Management', () => {
    it('should list contact messages for admin/manager (200)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/contact')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ search: 'Reservation Inquiry' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should block customer from accessing admin inbox (403)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/contact')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('should retrieve single message detail (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/contact/${testMessageId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(testEmail);
    });

    it('should mark a message as read (200)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/contact/${testMessageId}/read`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isRead: true });

      expect(res.status).toBe(200);
      expect(res.body.data.isRead).toBe(true);
    });

    it('should soft delete a message (200)', async () => {
      const url = `/api/v1/admin/contact/${testMessageId}`;
      const res = await request(app)
        .delete(url)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      // Verify it is excluded from admin list now
      const listRes = await request(app)
        .get('/api/v1/admin/contact')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ search: 'Reservation Inquiry' });

      const found = listRes.body.data.find((m: { id: string }) => m.id === testMessageId);
      expect(found).toBeUndefined();
    });

    it('should fetch contact statistics (200)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/contact/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalMessages).toBeDefined();
      expect(res.body.data.unreadMessages).toBeDefined();
    });
  });

  // ── 3. NEWSLETTER SYSTEM ────────────────────────────────────────────────────

  describe('3. Newsletter Subscription System', () => {
    it('should subscribe a new email (201)', async () => {
      const res = await request(app).post('/api/v1/newsletter').send({
        email: newsletterEmail,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isActive).toBe(true);
      testSubscriberId = res.body.data.id;
    });

    it('should reject duplicate subscription (409)', async () => {
      const res = await request(app).post('/api/v1/newsletter').send({
        email: newsletterEmail,
      });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DUPLICATE_SUBSCRIPTION');
    });

    it('should unsubscribe an email (200)', async () => {
      const res = await request(app).post('/api/v1/newsletter/unsubscribe').send({
        email: newsletterEmail,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
      expect(res.body.data.unsubscribedAt).toBeDefined();
    });

    it('should support re-subscription (201)', async () => {
      const res = await request(app).post('/api/v1/newsletter').send({
        email: newsletterEmail,
      });

      expect(res.status).toBe(201);
      expect(res.body.data.isActive).toBe(true);
      expect(res.body.data.unsubscribedAt).toBeNull();
    });

    it('should list newsletter subscribers for admin (200)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/newsletter')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should export subscribers in JSON format by default (200)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/newsletter/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
    });

    it('should export subscribers in CSV format (200)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/newsletter/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ format: 'csv' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('email,subscribedAt,isActive');
    });

    it('should delete a subscriber (200)', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/newsletter/${testSubscriberId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('should fetch newsletter statistics (200)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/newsletter/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.activeSubscribers).toBeDefined();
    });
  });
});
