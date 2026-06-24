import request from 'supertest';
import app from '../src/app';
import { prisma, disconnectPrisma } from '../src/config/prisma';
import { getRedisClient, disconnectRedis } from '../src/config/redis';

describe('Purchase Order API Suite', () => {
  let adminToken: string;
  let supplierId: string;
  let ingredientId: string;
  let purchaseOrderId: string;

  beforeAll(async () => {
    const r = getRedisClient();
    if (r.status === 'ready') await r.flushall();

    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@elixirandoak.in',
      password: 'Password123!',
    });
    adminToken = adminLogin.body.data.accessToken;

    // Create supplier
    const sup = await prisma.supplier.create({
      data: {
        name: 'Test-Sup-FlourSupplier Ltd',
        email: 'flour@test.com',
      },
    });
    supplierId = sup.id;

    // Create ingredient
    const ing = await prisma.ingredient.create({
      data: {
        name: 'Test-Ing-HighGlutenFlour',
        sku: 'TEST-SKU-HGFLOUR',
        unit: 'kg',
        currentStock: 10.0,
        minimumStock: 50.0,
        costPerUnit: 40.0,
      },
    });
    ingredientId = ing.id;
  });

  afterAll(async () => {
    await prisma.stockMovement.deleteMany();
    await prisma.purchaseOrderHistory.deleteMany();
    await prisma.purchaseOrderItem.deleteMany();
    await prisma.purchaseOrder.deleteMany();
    await prisma.supplier.deleteMany({ where: { id: supplierId } });
    await prisma.ingredient.deleteMany({ where: { id: ingredientId } });
    await disconnectRedis();
    await disconnectPrisma();
  });

  describe('PO Operations & Receiving Idempotency', () => {
    it('should create a new Purchase Order in DRAFT status', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierId,
          items: [
            {
              ingredientId,
              quantity: 100.0,
              unitCost: 38.5,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('DRAFT');
      expect(Number(res.body.data.totalAmount)).toBe(3850.0);
      purchaseOrderId = res.body.data.id;
    });

    it('should retrieve PO details', async () => {
      const res = await request(app)
        .get(`/api/v1/purchase-orders/${purchaseOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
    });

    it('should successfully receive PO, increase stock, and log StockMovement', async () => {
      // Transition from DRAFT to RECEIVED
      const res = await request(app)
        .put(`/api/v1/purchase-orders/${purchaseOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'RECEIVED',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('RECEIVED');

      // Verify ingredient stock increased by 100
      const ingredient = await prisma.ingredient.findUnique({
        where: { id: ingredientId },
        select: { currentStock: true },
      });
      expect(Number(ingredient?.currentStock)).toBe(110.0);

      // Verify StockMovement recorded
      const movement = await prisma.stockMovement.findFirst({
        where: { ingredientId, type: 'PURCHASE', referenceId: purchaseOrderId },
      });
      expect(movement).toBeDefined();
      expect(Number(movement?.quantity)).toBe(100.0);
    });

    it('should block duplicate receiving (idempotency guard)', async () => {
      const res = await request(app)
        .put(`/api/v1/purchase-orders/${purchaseOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'RECEIVED',
        });

      // Should fail with 422 standard code
      expect(res.status).toBe(422);
      expect(res.body.message).toContain('already received');
    });
  });
});
