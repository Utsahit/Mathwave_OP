import request from 'supertest';
import app from '../src/app';
import { prisma, disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

describe('Order API Integration Tests', () => {
  let menuItemId: string;
  let cartId: string;
  const sessionId = 'order-test-session-999';

  beforeAll(async () => {
    let category = await prisma.menuCategory.findFirst({
      where: { name: 'Order Test Desserts Category' },
    });
    if (!category) {
      category = await prisma.menuCategory.create({
        data: {
          name: 'Order Test Desserts Category',
          slug: 'order-test-desserts-category',
        },
      });
    }

    let menuItem = await prisma.menuItem.findFirst({
      where: { categoryId: category.id },
    });
    if (!menuItem) {
      menuItem = await prisma.menuItem.create({
        data: {
          name: 'Order Test Lava Cake',
          slug: 'order-test-lava-cake',
          description: 'Warm chocolate cake with molten center',
          price: 299.0,
          categoryId: category.id,
        },
      });
    }
    menuItemId = menuItem.id;

    // Populate a cart
    const cartRes = await request(app)
      .post('/api/v1/cart/items')
      .query({ sessionId })
      .send({
        menuItemId,
        quantity: 1,
      });
    cartId = cartRes.body.data.id;
  });

  afterAll(async () => {
    await disconnectPrisma();
    await disconnectRedis();
  });

  describe('Order Creation & Processing Flow', () => {
    let createdOrderId: string;
    let orderNumber: string;

    it('should create an order successfully from a populated cart', async () => {
      const res = await request(app).post('/api/v1/orders').send({
        cartId,
        customerName: 'Sanjay Kumar',
        customerEmail: 'sanjay@example.com',
        customerPhone: '9876543210',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customerName).toBe('Sanjay Kumar');
      expect(res.body.data.finalAmount).toBeDefined();

      createdOrderId = res.body.data.id;
      orderNumber = res.body.data.orderNumber;
    });

    it('should retrieve a single order by ID', async () => {
      const res = await request(app).get(`/api/v1/orders/${createdOrderId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdOrderId);
    });

    it('should retrieve a single order by Order Number', async () => {
      const res = await request(app).get(`/api/v1/orders/number/${orderNumber}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderNumber).toBe(orderNumber);
    });
  });
});
