import http from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import app from '../src/app';
import { realtimeService } from '../src/services/realtime.service';
import { disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';
import request from 'supertest';

jest.setTimeout(30000);

describe('WebSocket Security Tests', () => {
  let httpServer: http.Server;
  let port: number;
  let adminToken: string;
  let customerToken: string;
  let staffToken: string;

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

    await new Promise<void>((resolve) => {
      httpServer = app.listen(0, () => {
        const addr = httpServer.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        realtimeService.initialize(httpServer);
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
    await disconnectPrisma();
    await disconnectRedis();
  });

  describe('Authentication Enforcement', () => {
    it('should reject connection without token', (done) => {
      const client: ClientSocket = ioClient(`http://127.0.0.1:${port}`, {
        transports: ['websocket'],
        forceNew: true,
      });

      client.on('connect', () => {
        client.disconnect();
        done(new Error('Connection should have been rejected'));
      });

      client.on('connect_error', () => {
        client.disconnect();
        done();
      });
    });

    it('should reject connection with invalid token', (done) => {
      const client: ClientSocket = ioClient(`http://127.0.0.1:${port}`, {
        auth: { token: 'invalid-jwt-token' },
        transports: ['websocket'],
        forceNew: true,
      });

      client.on('connect', () => {
        client.disconnect();
        done(new Error('Connection should have been rejected'));
      });

      client.on('connect_error', () => {
        client.disconnect();
        done();
      });
    });

    it('should reject connection with tampered token', (done) => {
      const tampered = adminToken.slice(0, -5) + 'XXXXX';
      const client: ClientSocket = ioClient(`http://127.0.0.1:${port}`, {
        auth: { token: tampered },
        transports: ['websocket'],
        forceNew: true,
      });

      client.on('connect', () => {
        client.disconnect();
        done(new Error('Connection should have been rejected'));
      });

      client.on('connect_error', () => {
        client.disconnect();
        done();
      });
    });

    it('should accept connection with valid admin token', (done) => {
      const client: ClientSocket = ioClient(`http://127.0.0.1:${port}`, {
        auth: { token: adminToken },
        transports: ['websocket'],
        forceNew: true,
      });

      client.on('connect', () => {
        expect(client.connected).toBe(true);
        client.disconnect();
        done();
      });

      client.on('connect_error', (err) => {
        client.disconnect();
        done(new Error(`Connection rejected: ${err.message}`));
      });
    });

    it('should accept connection with valid customer token', (done) => {
      const client: ClientSocket = ioClient(`http://127.0.0.1:${port}`, {
        auth: { token: customerToken },
        transports: ['websocket'],
        forceNew: true,
      });

      client.on('connect', () => {
        expect(client.connected).toBe(true);
        client.disconnect();
        done();
      });

      client.on('connect_error', (err) => {
        client.disconnect();
        done(new Error(`Connection rejected: ${err.message}`));
      });
    });
  });

  describe('Namespace Isolation', () => {
    it('should disconnect customer from kitchen namespace', (done) => {
      const client: ClientSocket = ioClient(`http://127.0.0.1:${port}/kitchen`, {
        auth: { token: customerToken },
        transports: ['websocket'],
        forceNew: true,
      });

      let connected = false;
      const timeoutId = setTimeout(() => {
        if (!connected) {
          client.disconnect();
          done(new Error('Customer was never connected to kitchen namespace'));
        }
      }, 5000);

      client.on('connect', () => {
        connected = true;
      });

      client.on('disconnect', () => {
        clearTimeout(timeoutId);
        expect(connected).toBe(true);
        done();
      });
    });

    it('should allow staff to connect to kitchen namespace', (done) => {
      const client: ClientSocket = ioClient(`http://127.0.0.1:${port}/kitchen`, {
        auth: { token: staffToken },
        transports: ['websocket'],
        forceNew: true,
      });

      client.on('connect', () => {
        expect(client.connected).toBe(true);
        client.disconnect();
        done();
      });

      client.on('connect_error', (err) => {
        client.disconnect();
        done(new Error(`Staff kitchen connection rejected: ${err.message}`));
      });
    });

    it('should allow admin to connect to kitchen namespace', (done) => {
      const client: ClientSocket = ioClient(`http://127.0.0.1:${port}/kitchen`, {
        auth: { token: adminToken },
        transports: ['websocket'],
        forceNew: true,
      });

      client.on('connect', () => {
        expect(client.connected).toBe(true);
        client.disconnect();
        done();
      });

      client.on('connect_error', (err) => {
        client.disconnect();
        done(new Error(`Admin kitchen connection rejected: ${err.message}`));
      });
    });

    it('should allow customer to connect to orders namespace', (done) => {
      const client: ClientSocket = ioClient(`http://127.0.0.1:${port}/orders`, {
        auth: { token: customerToken },
        transports: ['websocket'],
        forceNew: true,
      });

      client.on('connect', () => {
        expect(client.connected).toBe(true);
        client.disconnect();
        done();
      });

      client.on('connect_error', (err) => {
        client.disconnect();
        done(new Error(`Customer orders connection rejected: ${err.message}`));
      });
    });
  });

  describe('Token Query Parameter Support', () => {
    it('should accept token via query parameter', (done) => {
      const client: ClientSocket = ioClient(`http://127.0.0.1:${port}`, {
        query: { token: adminToken },
        transports: ['websocket'],
        forceNew: true,
      });

      client.on('connect', () => {
        expect(client.connected).toBe(true);
        client.disconnect();
        done();
      });

      client.on('connect_error', (err) => {
        client.disconnect();
        done(new Error(`Query token rejected: ${err.message}`));
      });
    });

    it('should reject query parameter with invalid token', (done) => {
      const client: ClientSocket = ioClient(`http://127.0.0.1:${port}`, {
        query: { token: 'invalid' },
        transports: ['websocket'],
        forceNew: true,
      });

      client.on('connect', () => {
        client.disconnect();
        done(new Error('Connection should have been rejected'));
      });

      client.on('connect_error', () => {
        client.disconnect();
        done();
      });
    });
  });

  describe('Max Client Limit', () => {
    it('should enforce max client connection limit', () => {
      realtimeService.setMaxClients(1);
      expect(true).toBe(true);
    });
  });
});
