import request from 'supertest';
import app from '../src/app';
import { prisma, disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Kitchen API Integration Tests', () => {
  let adminToken: string;
  let staffToken: string;
  let menuItemId: string;
  let orderId: string;
  let ticketId: string;
  let stationId: string;

  beforeAll(async () => {
    // Login as admin
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@elixirandoak.in',
      password: 'Password123!',
    });
    adminToken = loginRes.body.data.accessToken;

    // Login as staff
    const staffLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'staff@elixirandoak.in',
      password: 'Password123!',
    });
    staffToken = staffLogin.body.data.accessToken;

    // Get or create menu item
    let menuItem = await prisma.menuItem.findFirst();
    if (!menuItem) {
      const category = await prisma.menuCategory.create({
        data: { name: 'Kitchen Test Category', slug: 'kitchen-test-category' },
      });
      menuItem = await prisma.menuItem.create({
        data: {
          name: 'Kitchen Test Item',
          slug: 'kitchen-test-item',
          description: 'Test item for kitchen tests',
          price: 199,
          categoryId: category.id,
        },
      });
    }
    menuItemId = menuItem.id;

    // Get first active station
    const station = await prisma.kitchenStation.findFirst({ where: { isActive: true } });
    if (station) {
      stationId = station.id;
    }

    // Create cart and order
    const sessionId = `kitchen-test-${Date.now()}`;
    const cartRes = await request(app)
      .post('/api/v1/cart/items')
      .query({ sessionId })
      .send({ menuItemId, quantity: 1 });
    const cartId = cartRes.body.data.id;

    const orderRes = await request(app).post('/api/v1/orders').send({
      cartId,
      customerName: 'Kitchen Test',
      customerEmail: 'kitchen@test.com',
      customerPhone: '9999999999',
    });
    orderId = orderRes.body.data.id;

    // Confirm the order
    await request(app)
      .put(`/api/v1/orders/admin/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CONFIRMED' });

    // Create kitchen ticket directly (the existing order endpoint doesn't use fulfillment service)
    const ticket = await prisma.kitchenTicket.create({
      data: { orderId },
    });
    ticketId = ticket.id;
  });

  afterAll(async () => {
    await disconnectPrisma();
    await disconnectRedis();
  });

  describe('Kitchen Ticket Operations', () => {
    it('should list kitchen tickets', async () => {
      const res = await request(app)
        .get('/api/v1/kitchen/tickets')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should get a single ticket by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/kitchen/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(ticketId);
    });

    it('should assign a ticket to a station', async () => {
      if (!stationId) return;

      const res = await request(app)
        .put(`/api/v1/kitchen/tickets/${ticketId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stationId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stationId).toBe(stationId);
    });

    it('should start preparation on a ticket', async () => {
      const res = await request(app)
        .put(`/api/v1/kitchen/tickets/${ticketId}/start`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should complete preparation on a ticket', async () => {
      const res = await request(app)
        .put(`/api/v1/kitchen/tickets/${ticketId}/complete`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should update ticket priority', async () => {
      const res = await request(app)
        .put(`/api/v1/kitchen/tickets/${ticketId}/priority`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ priority: 'HIGH' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.priority).toBe('HIGH');
    });

    it('should reject invalid priority values', async () => {
      const res = await request(app)
        .put(`/api/v1/kitchen/tickets/${ticketId}/priority`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ priority: 'INVALID' });

      expect(res.status).toBe(400);
    });

    it('should reject STAFF from assigning tickets (RBAC)', async () => {
      if (!stationId) return;

      const res = await request(app)
        .put(`/api/v1/kitchen/tickets/${ticketId}/assign`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ stationId });

      expect(res.status).toBe(403);
    });
  });
});
