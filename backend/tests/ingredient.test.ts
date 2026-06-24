import request from 'supertest';
import app from '../src/app';
import { prisma, disconnectPrisma } from '../src/config/prisma';
import { getRedisClient, disconnectRedis } from '../src/config/redis';

describe('Ingredient API Integration Tests', () => {
  let adminToken: string;
  let staffToken: string;
  let customerToken: string;
  let ingredientId: string;

  beforeAll(async () => {
    const r = getRedisClient();
    if (r.status === 'ready') await r.flushall();

    // Log in as seeded users
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

    const customerLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'customer@elixirandoak.in',
      password: 'Password123!',
    });
    customerToken = customerLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.stockMovement.deleteMany();
    await prisma.ingredient.deleteMany({
      where: {
        name: { startsWith: 'Test-Ing-' },
      },
    });
    await disconnectRedis();
    await disconnectPrisma();
  });

  describe('Ingredient CRUD Lifecycle', () => {
    it('should block anonymous ingredient creation', async () => {
      const res = await request(app).post('/api/v1/inventory/ingredients').send({
        name: 'Test-Ing-Salt',
        sku: 'TEST-SKU-SALT',
        unit: 'grams',
        currentStock: 1000,
        minimumStock: 100,
        costPerUnit: 0.1,
      });
      expect(res.status).toBe(401);
    });

    it('should block Customer role from creating ingredients', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/ingredients')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Test-Ing-Salt',
          sku: 'TEST-SKU-SALT',
          unit: 'grams',
          currentStock: 1000,
          minimumStock: 100,
          costPerUnit: 0.1,
        });
      expect(res.status).toBe(403);
    });

    it('should allow Admin to create a new ingredient', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/ingredients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test-Ing-Flour',
          sku: 'TEST-SKU-FLOUR',
          unit: 'kg',
          currentStock: 50.5,
          minimumStock: 10.0,
          costPerUnit: 45.0,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test-Ing-Flour');
      expect(res.body.data.sku).toBe('TEST-SKU-FLOUR');
      ingredientId = res.body.data.id;
    });

    it('should reject duplicate ingredient names', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/ingredients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test-Ing-Flour',
          sku: 'TEST-SKU-FLOUR2',
          unit: 'kg',
          currentStock: 10,
          minimumStock: 2,
          costPerUnit: 40,
        });

      expect(res.status).toBe(409);
    });

    it('should retrieve a single ingredient', async () => {
      const res = await request(app)
        .get(`/api/v1/inventory/ingredients/${ingredientId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Test-Ing-Flour');
    });

    it('should allow Admin to update an ingredient', async () => {
      const res = await request(app)
        .put(`/api/v1/inventory/ingredients/${ingredientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          minimumStock: 15.0,
        });

      expect(res.status).toBe(200);
      expect(Number(res.body.data.minimumStock)).toBe(15.0);
    });

    it('should soft-delete an ingredient successfully', async () => {
      const res = await request(app)
        .delete(`/api/v1/inventory/ingredients/${ingredientId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      // Verify not accessible via get
      const getRes = await request(app)
        .get(`/api/v1/inventory/ingredients/${ingredientId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(404);
    });
  });
});
