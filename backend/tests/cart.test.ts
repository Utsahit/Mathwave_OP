import request from 'supertest';
import app from '../src/app';
import { prisma, disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

describe('Cart API Integration Tests', () => {
  let menuItemId: string;

  beforeAll(async () => {
    // Ensure we have a menu category and item in db
    let category = await prisma.menuCategory.findFirst({
      where: { name: 'Cart Test Desserts Category' },
    });
    if (!category) {
      category = await prisma.menuCategory.create({
        data: {
          name: 'Cart Test Desserts Category',
          slug: 'cart-test-desserts-category',
        },
      });
    }

    let menuItem = await prisma.menuItem.findFirst({
      where: { categoryId: category.id },
    });
    if (!menuItem) {
      menuItem = await prisma.menuItem.create({
        data: {
          name: 'Cart Test Lava Cake',
          slug: 'cart-test-lava-cake',
          description: 'Warm chocolate cake with molten center',
          price: 299.0,
          categoryId: category.id,
        },
      });
    }
    menuItemId = menuItem.id;
  });

  afterAll(async () => {
    await disconnectPrisma();
    await disconnectRedis();
  });

  describe('Cart operations', () => {
    const sessionId = 'test-session-xyz-123';

    it('should retrieve a new cart when requested', async () => {
      const res = await request(app).get('/api/v1/cart').query({ sessionId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sessionId).toBe(sessionId);
      expect(res.body.data.items).toEqual([]);
    });

    it('should add a item to the cart', async () => {
      const res = await request(app)
        .post('/api/v1/cart/items')
        .query({ sessionId })
        .send({
          menuItemId,
          quantity: 2,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].menuItemId).toBe(menuItemId);
      expect(res.body.data.items[0].quantity).toBe(2);
      expect(res.body.data.totals.subtotal).toBe(598);
    });

    it('should update a item quantity in the cart', async () => {
      // Find the cart item id first
      const cartRes = await request(app).get('/api/v1/cart').query({ sessionId });
      const cartItemId = cartRes.body.data.items[0].id;

      const res = await request(app)
        .put(`/api/v1/cart/items/${cartItemId}`)
        .query({ sessionId })
        .send({
          quantity: 5,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items[0].quantity).toBe(5);
      expect(res.body.data.totals.subtotal).toBe(1495);
    });

    it('should remove a item from the cart', async () => {
      const cartRes = await request(app).get('/api/v1/cart').query({ sessionId });
      const cartItemId = cartRes.body.data.items[0].id;

      const res = await request(app)
        .delete(`/api/v1/cart/items/${cartItemId}`)
        .query({ sessionId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(0);
      expect(res.body.data.totals.subtotal).toBe(0);
    });
  });
});
