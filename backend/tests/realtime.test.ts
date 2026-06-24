import http from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import app from '../src/app';
import { realtimeService } from '../src/services/realtime.service';
import { disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';
import request from 'supertest';

jest.setTimeout(30000);

describe('Realtime (Socket.IO) Integration Tests', () => {
  let httpServer: http.Server;
  let port: number;
  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    // Login as admin to get a valid token
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@elixirandoak.in',
      password: 'Password123!',
    });
    adminToken = loginRes.body.data.accessToken;

    // Login as customer for namespace rejection test
    const customerLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'customer@elixirandoak.in',
      password: 'Password123!',
    });
    customerToken = customerLogin.body.data.accessToken;

    // Start a real HTTP server with Socket.IO for tests
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

  describe('Socket Authentication', () => {
    it('should accept connection with a valid token', (done) => {
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

    it('should reject connection with an invalid token', (done) => {
      const client: ClientSocket = ioClient(`http://127.0.0.1:${port}`, {
        auth: { token: 'invalid-token' },
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

    it('should reject connection without a token', (done) => {
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
  });

  describe('Kitchen Namespace', () => {
    it('should connect to kitchen namespace with admin token', (done) => {
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
        done(new Error(`Kitchen namespace connection rejected: ${err.message}`));
      });
    });

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

    it('should receive broadcast events on kitchen namespace', (done) => {
      const client: ClientSocket = ioClient(`http://127.0.0.1:${port}/kitchen`, {
        auth: { token: adminToken },
        transports: ['websocket'],
        forceNew: true,
      });

      client.on('connect', () => {
        realtimeService.broadcastToKitchen('TEST_EVENT', { test: true });
      });

      client.on('TEST_EVENT', (data) => {
        expect(data).toEqual({ test: true });
        client.disconnect();
        done();
      });

      client.on('connect_error', (err) => {
        client.disconnect();
        done(new Error(`Kitchen namespace connection rejected: ${err.message}`));
      });
    });
  });

  describe('Order Namespace', () => {
    it('should connect to orders namespace with admin token', (done) => {
      const client: ClientSocket = ioClient(`http://127.0.0.1:${port}/orders`, {
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
        done(new Error(`Orders namespace connection rejected: ${err.message}`));
      });
    });
  });
});
