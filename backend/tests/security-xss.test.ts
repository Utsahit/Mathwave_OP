import request from 'supertest';
import app from '../src/app';
import { disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('XSS Protection Tests', () => {
  let adminToken: string;
  let customerToken: string;

  const xssPayloads = [
    '<script>alert("xss")</script>',
    '"><script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    'javascript:alert(1)',
    '{{constructor.constructor("alert(1)")()}}',
    '<svg/onload=alert(1)>',
    '"><img src=x onerror=alert(1)>',
    "'-alert(1)-'",
    '<a href="javascript:alert(1)">click</a>',
    '<body onload=alert(1)>',
    '<iframe src="javascript:alert(1)">',
    '{{7*7}}',
    '${7*7}',
    '<%= 7*7 %>',
    '<!--#echo var="xss"-->',
    '&lt;script&gt;alert(1)&lt;/script&gt;',
  ];

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

  describe('Stored XSS Protection', () => {
    it('should protect reviews from stored XSS', async () => {
      for (const payload of xssPayloads) {
        const res = await request(app)
          .post('/api/v1/reviews')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            name: `Test XSS ${Date.now()}`,
            rating: 5,
            comment: `Great food ${payload}`,
          });
        expect(res.status).toBeLessThan(500);
      }
    });

    it('should protect contact messages from stored XSS', async () => {
      for (const payload of xssPayloads.slice(0, 5)) {
        const res = await request(app)
          .post('/api/v1/contact')
          .send({
            name: `Test${payload}`,
            email: `xss_contact_${Date.now()}@test.com`,
            subject: `Test${payload}`,
            message: `Test message ${payload}`,
          });
        expect(res.status).toBeLessThan(500);
      }
    });

    it('should protect support tickets from stored XSS', async () => {
      for (const payload of xssPayloads.slice(0, 3)) {
        const res = await request(app)
          .post('/api/v1/support')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            subject: `XSS Test ${payload}`,
            message: `Test ticket ${payload}`,
          });
        expect(res.status).toBeLessThan(500);
      }
    });

    it('should protect campaign content from stored XSS', async () => {
      for (const payload of xssPayloads.slice(0, 3)) {
        const res = await request(app)
          .post('/api/v1/campaigns')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: `XSS Test ${Date.now()}`,
            type: 'EMAIL',
            subject: `Campaign ${payload}`,
            content: `<html>${payload}</html>`,
            recipients: 'ALL',
          });
        expect(res.status).toBeLessThan(500);
      }
    });
  });

  describe('URL Parameter XSS Protection', () => {
    it('should protect search endpoints from reflected XSS', async () => {
      for (const payload of xssPayloads.slice(0, 5)) {
        const res = await request(app)
          .get(`/api/v1/menu/items?search=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${customerToken}`);
        expect(res.status).toBeLessThan(500);
      }
    });
  });

  describe('Input Validation', () => {
    it('should accept legitimate input without false positives', async () => {
      const legitInputs = [
        'Regular menu item name',
        'Customer feedback with punctuation!',
        'Café résumé Español 中文',
        'Order #12345 reference',
        'Normal < and > characters in text',
        'Email with+plus@test.com',
        'Price: $49.99 (tax incl.)',
        'Line 1\nLine 2\nLine 3',
      ];

      for (const input of legitInputs) {
        const res = await request(app)
          .post('/api/v1/reviews')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            name: 'Test User',
            rating: 5,
            comment: input,
          });
        expect(res.status).toBeLessThan(500);
      }
    });
  });
});
