import request from 'supertest';
import app from '../src/app';
import { disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

describe('Health and Ready Endpoints Probes', () => {
  afterAll(async () => {
    // Clean up connection drivers to prevent jest open handle warnings
    await disconnectPrisma();
    await disconnectRedis();
  });

  it('should return 200 OK for GET /api/v1/health liveness probe', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
  });

  it('should return status for GET /api/v1/ready probe', async () => {
    const res = await request(app).get('/api/v1/ready');
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.database).toBe('connected');
      expect(res.body.data.redis).toBe('connected');
    } else {
      expect(res.body.success).toBe(false);
      expect(res.body.errors[0].status).toBe('unhealthy');
    }
  });

  it('should return 200 OK for GET /api/v1/version metadata probe', async () => {
    const res = await request(app).get('/api/v1/version');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.version).toBe('1.0.0');
  });
});
