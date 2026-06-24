import request from 'supertest';
import app from '../src/app';
import { prisma, disconnectPrisma } from '../src/config/prisma';
import { getRedisClient, disconnectRedis } from '../src/config/redis';

describe('Supplier API Integration Tests', () => {
  let adminToken: string;
  let staffToken: string;
  let supplierId: string;
  let ingredientId: string;

  beforeAll(async () => {
    const r = getRedisClient();
    if (r.status === 'ready') await r.flushall();

    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@elixirandoak.in',
      password: 'Password123!',
    });
    adminToken = adminLogin.body.data.accessToken;

    const staffLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'staff@elixirandoak.in',
      password: 'Password123!',
    });
    staffToken = staffLogin.body.data.accessToken;

    // Create an ingredient to map
    const ing = await prisma.ingredient.create({
      data: {
        name: 'Test-Ing-Yeast',
        sku: 'TEST-SKU-YEAST',
        unit: 'grams',
        currentStock: 500,
        minimumStock: 100,
        costPerUnit: 1.5,
      },
    });
    ingredientId = ing.id;
  });

  afterAll(async () => {
    await prisma.supplierIngredient.deleteMany();
    await prisma.supplier.deleteMany({
      where: {
        name: { startsWith: 'Test-Sup-' },
      },
    });
    await prisma.ingredient.deleteMany({
      where: {
        id: ingredientId,
      },
    });
    await disconnectRedis();
    await disconnectPrisma();
  });

  describe('Supplier CRUD and Mappings', () => {
    it('should allow Admin to create a new supplier', async () => {
      const res = await request(app)
        .post('/api/v1/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test-Sup-OrganicDistributors',
          email: 'organic@test.com',
          phone: '9999888877',
          address: 'Green Valley Road',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Test-Sup-OrganicDistributors');
      supplierId = res.body.data.id;
    });

    it('should map ingredient to supplier successfully', async () => {
      const res = await request(app)
        .post(`/api/v1/suppliers/${supplierId}/ingredients`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ingredientId,
          pricePerUnit: 1.25,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Number(res.body.data.pricePerUnit)).toBe(1.25);
    });

    it('should list supplier ingredients mapping', async () => {
      const res = await request(app)
        .get(`/api/v1/suppliers/${supplierId}/ingredients`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].ingredientId).toBe(ingredientId);
    });

    it('should allow removing mapped ingredient', async () => {
      const res = await request(app)
        .delete(`/api/v1/suppliers/${supplierId}/ingredients/${ingredientId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      const check = await request(app)
        .get(`/api/v1/suppliers/${supplierId}/ingredients`)
        .set('Authorization', `Bearer ${staffToken}`);
      expect(check.body.data.length).toBe(0);
    });

    it('should allow soft-delete of supplier', async () => {
      const res = await request(app)
        .delete(`/api/v1/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      const getRes = await request(app)
        .get(`/api/v1/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(404);
    });
  });
});
