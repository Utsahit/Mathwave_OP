import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { getRedisClient, disconnectRedis } from '../src/config/redis';
import { disconnectPrisma } from '../src/config/prisma';
import path from 'path';
import fs from 'fs';

jest.setTimeout(30000);

describe('Menu & Category Management Integration Suite', () => {
  let adminToken: string;
  let customerToken: string;
  let categoryId: string;
  let menuItemId: string;

  beforeAll(async () => {
    // 1. Warm up Redis connection
    const redis = getRedisClient();
    if (redis.status === 'ready') await redis.flushall();

    // 2. Log in as Seeded Admin
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@elixirandoak.in',
      password: 'Password123!',
    });
    adminToken = adminLogin.body.data.accessToken;

    // 3. Log in as Seeded Customer
    const customerLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'customer@elixirandoak.in',
      password: 'Password123!',
    });
    customerToken = customerLogin.body.data.accessToken;
  });

  afterAll(async () => {
    // Cleanup items created during testing
    await prisma.menuItem.deleteMany({
      where: {
        slug: { in: ['test-brew', 'updated-test-brew', 'duplicate-item'] },
      },
    });

    await prisma.menuCategory.deleteMany({
      where: {
        slug: { in: ['test-beverages', 'updated-beverages', 'duplicate-cat'] },
      },
    });

    await disconnectRedis();
    await disconnectPrisma();
  });

  describe('1. Category CRUD & Validation', () => {
    it('should create a new category successfully as Admin', async () => {
      const res = await request(app)
        .post('/api/v1/menu/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Beverages',
          slug: 'test-beverages',
          description: 'Specialty test coffee beverages.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe('test-beverages');
      categoryId = res.body.data.id;
    });

    it('should reject creating a category with duplicate slug', async () => {
      const res = await request(app)
        .post('/api/v1/menu/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Alternative Name',
          slug: 'test-beverages', // Duplicate slug!
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('DUPLICATE_SLUG');
    });

    it('should prevent non-admin/customers from creating categories (RBAC)', async () => {
      const res = await request(app)
        .post('/api/v1/menu/categories')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Unauthorized Category',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should update a category successfully', async () => {
      const res = await request(app)
        .put(`/api/v1/menu/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Beverages',
          description: 'Refined description.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Beverages');
    });

    it('should read a single category successfully', async () => {
      const res = await request(app).get(`/api/v1/menu/categories/${categoryId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(categoryId);
    });

    it('should list categories with search and pagination', async () => {
      const res = await request(app).get('/api/v1/menu/categories').query({
        search: 'Beverages',
        page: 1,
        limit: 5,
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('2. MenuItem CRUD & Validation', () => {
    it('should create a new menu item successfully as Admin', async () => {
      const res = await request(app)
        .post('/api/v1/menu/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          categoryId,
          name: 'Test Brew',
          slug: 'test-brew',
          description: 'A special cold extraction for integration testing.',
          price: 320.0,
          tags: ['test', 'integration'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe('test-brew');
      expect(res.body.data.tags).toContain('test');
      menuItemId = res.body.data.id;
    });

    it('should reject creating menu item with invalid/non-existent categoryId', async () => {
      const res = await request(app)
        .post('/api/v1/menu/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          categoryId: '00000000-0000-0000-0000-000000000000',
          name: 'Failed Item',
          description: 'Should fail due to category.',
          price: 100,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_CATEGORY');
    });

    it('should update a menu item successfully', async () => {
      const res = await request(app)
        .put(`/api/v1/menu/items/${menuItemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Test Brew',
          price: 340.0,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Test Brew');
      expect(res.body.data.price).toBe('340');
    });

    it('should read a single menu item successfully', async () => {
      const res = await request(app).get(`/api/v1/menu/items/${menuItemId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(menuItemId);
    });
  });

  describe('3. Public Endpoints & Caching', () => {
    it('should retrieve grouped public menu containing only active categories and items', async () => {
      const res = await request(app).get('/api/v1/menu/public');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.categories).toBeInstanceOf(Array);

      // Verify structure contains categories with nested items
      const category = res.body.data.categories.find(
        (c: { id: string }) => c.id === categoryId
      );
      expect(category).toBeDefined();
      expect(category.items).toBeInstanceOf(Array);
      expect(category.items.some((i: { id: string }) => i.id === menuItemId)).toBe(true);
    });

    it('should retrieve public categories list', async () => {
      const res = await request(app).get('/api/v1/menu/public/categories');
      expect(res.status).toBe(200);
      expect(res.body.data.categories).toBeInstanceOf(Array);
    });
  });

  describe('4. Search, Filter, Sort, Pagination', () => {
    it('should query menu items with complex search, active filter, sort by price desc, and pagination limits', async () => {
      const res = await request(app).get('/api/v1/menu/items').query({
        search: 'Brew',
        active: true,
        sortBy: 'price',
        order: 'desc',
        page: 1,
        limit: 10,
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(10);
    });
  });

  describe('5. Image Management & Uploads', () => {
    it('should upload a menu item image successfully as Admin', async () => {
      // Create a dummy image file for upload testing
      const dummyFilePath = path.join(__dirname, 'dummy.png');
      fs.writeFileSync(dummyFilePath, 'dummy file content');

      const res = await request(app)
        .post(`/api/v1/menu/items/${menuItemId}/image`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('image', dummyFilePath);

      // Clean up dummy file
      fs.unlinkSync(dummyFilePath);

      expect(res.status).toBe(200);
      expect(res.body.data.image).toBeDefined();
      expect(res.body.data.image).toContain('/uploads/');
    });
  });

  describe('6. Category/Item Deletion & Cleanup', () => {
    it('should soft-delete menu item successfully', async () => {
      const res = await request(app)
        .delete(`/api/v1/menu/items/${menuItemId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      // Verify item cannot be retrieved anymore (soft deleted)
      const getRes = await request(app).get(`/api/v1/menu/items/${menuItemId}`);
      expect(getRes.status).toBe(404);
    });

    it('should soft-delete category successfully', async () => {
      const res = await request(app)
        .delete(`/api/v1/menu/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      // Verify category cannot be retrieved anymore
      const getRes = await request(app).get(`/api/v1/menu/categories/${categoryId}`);
      expect(getRes.status).toBe(404);
    });
  });
});
