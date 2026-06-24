import request from 'supertest';
import app from '../src/app';
import { prisma, disconnectPrisma } from '../src/config/prisma';
import { getRedisClient, disconnectRedis } from '../src/config/redis';
import { stockService } from '../src/services/stock.service';

describe('Inventory & Stock Consumption Suite', () => {
  let adminToken: string;
  let categoryId: string;
  let menuItemId: string;
  let ingredientId: string;

  beforeAll(async () => {
    const r = getRedisClient();
    if (r.status === 'ready') await r.flushall();

    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@elixirandoak.in',
      password: 'Password123!',
    });
    adminToken = adminLogin.body.data.accessToken;

    // Create Category & MenuItem
    const uniqueId = Date.now();
    const cat = await prisma.menuCategory.create({
      data: {
        name: `Inventory Test Food ${uniqueId}`,
        slug: `inventory-test-food-${uniqueId}`,
      },
    });
    categoryId = cat.id;

    const item = await prisma.menuItem.create({
      data: {
        name: 'Inventory Test Burger',
        slug: 'inventory-test-burger',
        description: 'Juicy test burger',
        price: 350.0,
        categoryId,
      },
    });
    menuItemId = item.id;

    // Create Ingredient
    const ing = await prisma.ingredient.create({
      data: {
        name: 'Test-Ing-Patty',
        sku: 'TEST-SKU-PATTY',
        unit: 'piece',
        currentStock: 10.0, // starts with 10 patties
        minimumStock: 15.0,
        costPerUnit: 80.0,
      },
    });
    ingredientId = ing.id;

    // Create recipe mapping (Burger needs 1 Patty)
    await prisma.menuItemIngredient.create({
      data: {
        menuItemId,
        ingredientId,
        quantity: 1.0,
      },
    });
  });

  afterAll(async () => {
    await prisma.stockMovement.deleteMany();
    await prisma.kitchenTicket.deleteMany();
    await prisma.orderStatusHistory.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.menuItemIngredient.deleteMany();
    await prisma.ingredient.deleteMany({ where: { name: { startsWith: 'Test-Ing-' } } });
    await prisma.menuItem.deleteMany({ where: { id: menuItemId } });
    await prisma.menuCategory.deleteMany({ where: { id: categoryId } });
    await disconnectRedis();
    await disconnectPrisma();
  });

  describe('Low Stock & Stats', () => {
    it('should show ingredient in low-stock since currentStock (10) <= minimumStock (15)', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/low-stock')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const names = res.body.data.map((x: { name: string }) => x.name);
      expect(names).toContain('Test-Ing-Patty');
    });

    it('should retrieve inventory statistics successfully', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.lowStockCount).toBeGreaterThanOrEqual(1);
      expect(res.body.data.totalInventoryValue).toBeGreaterThan(0);
    });
  });

  describe('Manual Stock Adjustments', () => {
    it('should adjust stock up or down and track it', async () => {
      const res = await request(app)
        .post(`/api/v1/inventory/ingredients/${ingredientId}/adjust`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          quantity: 5,
          comment: 'Restock patties manually',
        });

      expect(res.status).toBe(200);

      const check = await prisma.ingredient.findUnique({
        where: { id: ingredientId },
        select: { currentStock: true },
      });
      expect(Number(check?.currentStock)).toBe(15.0);
    });
  });

  describe('Order Processing & Inventory Consumption Checks', () => {
    let orderId: string;

    beforeEach(async () => {
      // Clean up past test orders so we have a clean slate
      await prisma.kitchenTicket.deleteMany();
      await prisma.orderStatusHistory.deleteMany();
      await prisma.orderItem.deleteMany();
      await prisma.order.deleteMany();

      // Reset stock to exactly 5 patties
      await prisma.ingredient.update({
        where: { id: ingredientId },
        data: { currentStock: 5.0 },
      });
    });

    it('should consume stock successfully when order goes to CONFIRMED', async () => {
      // 1. Create order for 3 burgers (needs 3 patties)
      const order = await prisma.order.create({
        data: {
          orderNumber: `ORD-INVTEST-${Math.floor(1000 + Math.random() * 9000)}`,
          totalAmount: 1050.0,
          taxAmount: 50.0,
          finalAmount: 1100.0,
          customerName: 'Test Inv Cust',
          customerEmail: 'testinv@test.com',
          customerPhone: '1234567890',
          status: 'PENDING',
          items: {
            create: [
              {
                menuItemId,
                quantity: 3,
                unitPrice: 350.0,
                totalPrice: 1050.0,
              },
            ],
          },
        },
      });
      orderId = order.id;

      // 2. Put status to CONFIRMED
      const res = await request(app)
        .put(`/api/v1/orders/admin/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CONFIRMED' });

      expect(res.status).toBe(200);

      // 3. Verify stock decreased by 3 (from 5 to 2)
      const check = await prisma.ingredient.findUnique({
        where: { id: ingredientId },
        select: { currentStock: true },
      });
      expect(Number(check?.currentStock)).toBe(2.0);

      // 4. Verify order has stockConsumedAt set
      const orderCheck = await prisma.order.findUnique({
        where: { id: orderId },
        select: { stockConsumedAt: true },
      });
      expect(orderCheck?.stockConsumedAt).not.toBeNull();
    });

    it('should fail with 409 INSUFFICIENT_STOCK if order quantity exceeds stock', async () => {
      // 1. Create order for 6 burgers (needs 6 patties, but we only have 5)
      const order = await prisma.order.create({
        data: {
          orderNumber: `ORD-INVTEST-${Math.floor(1000 + Math.random() * 9000)}`,
          totalAmount: 2100.0,
          taxAmount: 100.0,
          finalAmount: 2200.0,
          customerName: 'Test Inv Cust',
          customerEmail: 'testinv@test.com',
          customerPhone: '1234567890',
          status: 'PENDING',
          items: {
            create: [
              {
                menuItemId,
                quantity: 6,
                unitPrice: 350.0,
                totalPrice: 2100.0,
              },
            ],
          },
        },
      });

      // 2. Transition order to CONFIRMED -> must fail
      const res = await request(app)
        .put(`/api/v1/orders/admin/${order.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CONFIRMED' });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Insufficient stock');
    });

    it('should execute concurrent transitions correctly and skip double deduction (stockConsumedAt guard)', async () => {
      // 1. Create order for 2 burgers (needs 2 patties, stock is 5)
      const order = await prisma.order.create({
        data: {
          orderNumber: `ORD-INVTEST-${Math.floor(1000 + Math.random() * 9000)}`,
          totalAmount: 700.0,
          taxAmount: 30.0,
          finalAmount: 730.0,
          customerName: 'Test Inv Cust',
          customerEmail: 'testinv@test.com',
          customerPhone: '1234567890',
          status: 'PENDING',
          items: {
            create: [
              {
                menuItemId,
                quantity: 2,
                unitPrice: 350.0,
                totalPrice: 700.0,
              },
            ],
          },
        },
      });

      // Execute two simultaneous calls to stock consumption service
      const p1 = stockService.consumeStockForOrder(order.id);
      const p2 = stockService.consumeStockForOrder(order.id);

      await Promise.all([p1, p2]);

      // Stock should only be decremented ONCE (from 5 to 3)
      const check = await prisma.ingredient.findUnique({
        where: { id: ingredientId },
        select: { currentStock: true },
      });
      expect(Number(check?.currentStock)).toBe(3.0);
    });
  });
});
