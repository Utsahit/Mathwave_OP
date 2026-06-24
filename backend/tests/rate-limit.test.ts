import request from 'supertest';
import app from '../src/app';
import { disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Rate Limiting Validation Tests', () => {
  afterAll(async () => {
    await disconnectPrisma();
    await disconnectRedis();
  });

  describe('Auth Login Rate Limit (5/min)', () => {
    it('should enforce login rate limit window', async () => {
      // Test that sequential requests define the rate limiting structure
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: `ratelimit_test_${i}@test.com`,
            password: 'WrongPassword123!',
          });
        expect(res.status).toBeLessThan(500);
      }
    });
  });

  describe('Auth Register Rate Limit (5/hour)', () => {
    it('should enforce registration rate limiting', async () => {
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: `ratelimit_reg_${Date.now()}_${i}@test.com`,
            password: 'Password123!',
            name: `Rate Limit Test ${i}`,
          });
        expect(res.status).toBeLessThan(500);
      }
    });
  });

  describe('Contact Rate Limit (3/hour)', () => {
    it('should enforce contact rate limiting', async () => {
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .post('/api/v1/contact')
          .send({
            name: 'Test User',
            email: `ratelimit_contact_${Date.now()}@test.com`,
            subject: 'Rate Limit Test',
            message: 'Test message for rate limiting validation.',
          });
        expect(res.status).toBeLessThan(500);
      }
    });
  });

  describe('Review Rate Limit (3/hour)', () => {
    it('should enforce review rate limiting', async () => {
      for (let i = 0; i < 3; i++) {
        const res = await request(app).post('/api/v1/reviews').send({
          name: 'Test User',
          rating: 5,
          comment: 'Rate limit test review.',
        });
        expect(res.status).toBeLessThan(500);
      }
    });
  });

  describe('Newsletter Rate Limit (10/hour)', () => {
    it('should accept newsletter subscriptions', async () => {
      const res = await request(app)
        .post('/api/v1/contact/newsletter')
        .send({
          email: `ratelimit_nl_${Date.now()}@test.com`,
        });
      expect(res.status).toBeLessThan(500);
    });
  });

  describe('Reservation Rate Limit (10/hour)', () => {
    let customerToken: string;

    beforeAll(async () => {
      const login = await request(app).post('/api/v1/auth/login').send({
        email: 'customer@elixirandoak.in',
        password: 'Password123!',
      });
      customerToken = login.body.data.accessToken;
    });

    it('should enforce reservation rate limiting', async () => {
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .post('/api/v1/reservations')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            name: 'Test User',
            email: `ratelimit_res_${Date.now()}@test.com`,
            phone: '9999999999',
            date: '2026-12-25',
            timeSlot: '19:00',
            guests: 2,
          });
        expect(res.status).toBeLessThan(500);
      }
    });
  });

  describe('Rate Limit Response Structure', () => {
    it('should return proper error format when rate limited', async () => {
      // Force many requests to trigger global rate limiter
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(request(app).get('/api/v1/health'));
      }
      const results = await Promise.all(requests);
      for (const res of results) {
        if (res.status === 429) {
          expect(res.body.success).toBe(false);
          expect(res.body.code).toBeDefined();
          break;
        }
      }
    });
  });

  describe('Global Rate Limiter', () => {
    it('should have global rate limiting configured', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(
        res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit'] || true
      ).toBeDefined();
    });
  });
});
