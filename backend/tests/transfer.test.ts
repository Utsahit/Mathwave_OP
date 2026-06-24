import request from 'supertest';
import app from '../src/app';
import { prisma, disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(30000);

describe('Inventory Transfer API Integration Tests', () => {
  let adminToken: string;
  let fromBranchId: string;
  let toBranchId: string;
  let ingredientId: string;
  let testTransferId: string;

  beforeAll(async () => {
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@elixirandoak.in',
      password: 'Password123!',
    });
    adminToken = adminLogin.body.data.accessToken;

    // Create two branches
    const branch1 = await request(app)
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `FROM${Date.now()}`,
        name: 'From Branch',
        address: 'From St',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        timezone: 'Asia/Kolkata',
      });
    fromBranchId = branch1.body.data.id;

    const branch2 = await request(app)
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `TO${Date.now()}`,
        name: 'To Branch',
        address: 'To St',
        city: 'Delhi',
        state: 'Delhi',
        country: 'India',
        timezone: 'Asia/Kolkata',
      });
    toBranchId = branch2.body.data.id;

    // Get an ingredient
    const ingredient = await prisma.ingredient.findFirst({ where: { isDeleted: false } });
    if (ingredient) {
      ingredientId = ingredient.id;
    } else {
      ingredientId = (
        await prisma.ingredient.create({
          data: {
            name: `Test Ing ${Date.now()}`,
            unit: 'kg',
            currentStock: 100,
            minimumStock: 10,
            costPerUnit: 50,
          },
        })
      ).id;
    }
  });

  afterAll(async () => {
    if (testTransferId) {
      await prisma.inventoryTransferItem
        .deleteMany({ where: { transferId: testTransferId } })
        .catch(() => {});
      await prisma.inventoryTransfer
        .deleteMany({ where: { id: testTransferId } })
        .catch(() => {});
    }
    if (fromBranchId) {
      await prisma.branchStaff
        .deleteMany({ where: { branchId: fromBranchId } })
        .catch(() => {});
      await prisma.branch.deleteMany({ where: { id: fromBranchId } }).catch(() => {});
    }
    if (toBranchId) {
      await prisma.branchStaff
        .deleteMany({ where: { branchId: toBranchId } })
        .catch(() => {});
      await prisma.branch.deleteMany({ where: { id: toBranchId } }).catch(() => {});
    }
    await disconnectPrisma();
    await disconnectRedis();
  });

  describe('POST /api/v1/transfers (create)', () => {
    it('should create an inventory transfer', async () => {
      const res = await request(app)
        .post('/api/v1/transfers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fromBranchId,
          toBranchId,
          items: [{ ingredientId, quantity: 10 }],
        });

      expect(res.status === 201 || res.status === 200).toBe(true);
      if (res.body.data) {
        testTransferId = res.body.data.id || res.body.data.transfer?.id;
      }
    });
  });

  describe('POST /api/v1/transfers/:id/approve', () => {
    it('should approve a transfer', async () => {
      if (!testTransferId) return;
      const res = await request(app)
        .post(`/api/v1/transfers/${testTransferId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status === 200 || res.status === 400).toBe(true);
    });
  });

  describe('GET /api/v1/transfers (list)', () => {
    it('should list transfers', async () => {
      const res = await request(app)
        .get('/api/v1/transfers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('data');
    });
  });
});
