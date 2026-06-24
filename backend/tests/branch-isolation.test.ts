import request from 'supertest';
import app from '../src/app';
import { prisma, disconnectPrisma } from '../src/config/prisma';
import { disconnectRedis } from '../src/config/redis';

jest.setTimeout(60000);

describe('Branch Isolation', () => {
  let adminToken: string;
  let branchAId: string;
  let branchBId: string;
  let managerToken: string;
  const testPrefix = `bi${Date.now()}`;

  beforeAll(async () => {
    // Login as admin
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@elixirandoak.in',
      password: 'Password123!',
    });
    adminToken = adminLogin.body.data.accessToken;

    // Create branch A
    const branchARes = await request(app)
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `${testPrefix}A`,
        name: `Branch A ${testPrefix}`,
        address: '111 Branch A St',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        timezone: 'Asia/Kolkata',
      });
    branchAId = branchARes.body.data.id;

    // Create branch B
    const branchBRes = await request(app)
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `${testPrefix}B`,
        name: `Branch B ${testPrefix}`,
        address: '222 Branch B St',
        city: 'Delhi',
        state: 'Delhi',
        country: 'India',
        timezone: 'Asia/Kolkata',
      });
    branchBId = branchBRes.body.data.id;

    // Create a MANAGER user assigned to Branch A
    const role = await prisma.dbRole.findUnique({ where: { name: 'MANAGER' } });
    if (!role) throw new Error('MANAGER role not found in seed');

    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@elixirandoak.in' },
      select: { passwordHash: true },
    });
    if (!adminUser) throw new Error('Admin user not found');

    const managerEmail = `manager.${testPrefix}@test.in`;
    const managerUser = await prisma.user.create({
      data: {
        name: `Manager ${testPrefix}`,
        email: managerEmail,
        passwordHash: adminUser.passwordHash,
        roleId: role.id,
        isDeleted: false,
      },
    });

    await prisma.branchStaff.create({
      data: {
        branchId: branchAId,
        userId: managerUser.id,
      },
    });

    // Login as manager
    const managerLogin = await request(app).post('/api/v1/auth/login').send({
      email: managerEmail,
      password: 'Password123!',
    });
    if (!managerLogin.body.data) {
      throw new Error('Manager login failed: ' + JSON.stringify(managerLogin.body));
    }
    managerToken = managerLogin.body.data.accessToken;

    // Create an order in Branch B
    const menuItem = await prisma.menuItem.findFirst({ select: { id: true } });
    if (!menuItem) throw new Error('No menu item found');

    // Create order in Branch B directly
    await prisma.order.create({
      data: {
        orderNumber: `${testPrefix}-ORD-B`,
        userId: managerUser.id,
        branchId: branchBId,
        totalAmount: 100,
        subtotalAmount: 100,
        taxAmount: 10,
        finalAmount: 110,
        customerName: 'Test Customer',
        customerEmail: 'test@test.in',
        customerPhone: '9999999999',
        status: 'PENDING',
      },
    });

    // Create a review in Branch B
    await prisma.review.create({
      data: {
        name: 'Reviewer B',
        email: 'reviewer.b@test.in',
        rating: 5,
        comment: 'Great food at Branch B!',
        branchId: branchBId,
        isApproved: true,
      },
    });

    // Create a reservation in Branch B
    const table = await prisma.table.findFirst({
      where: { isDeleted: false },
      select: { id: true },
    });
    if (table) {
      await prisma.reservation.create({
        data: {
          reservationCode: `${testPrefix}-RES-B`,
          name: 'Guest B',
          email: 'guest.b@test.in',
          phone: '9999999998',
          date: new Date('2026-12-25'),
          timeSlot: '19:00',
          guests: 2,
          branchId: branchBId,
          tableId: table.id,
          status: 'CONFIRMED',
        },
      });
    }
  });

  afterAll(async () => {
    // Clean up in reverse order
    const testBranchStaffA = await prisma.branchStaff.findFirst({
      where: { branchId: branchAId },
      select: { id: true },
    });
    if (testBranchStaffA) {
      const staff = await prisma.branchStaff.findUnique({
        where: { id: testBranchStaffA.id },
        select: { userId: true },
      });
      if (staff) {
        const managerUser = await prisma.user.findUnique({
          where: { id: staff.userId },
          select: { id: true, email: true },
        });
        if (managerUser) {
          await prisma.branchStaff.deleteMany({ where: { userId: managerUser.id } });
          await prisma.order.deleteMany({
            where: { orderNumber: { startsWith: testPrefix } },
          });
          await prisma.review.deleteMany({ where: { email: { endsWith: '@test.in' } } });
          await prisma.reservation.deleteMany({
            where: { reservationCode: { startsWith: testPrefix } },
          });
          await prisma.user.delete({ where: { id: managerUser.id } }).catch(() => {});
        }
      }
    }
    await prisma.branch
      .deleteMany({ where: { code: { startsWith: testPrefix } } })
      .catch(() => {});
    await disconnectPrisma();
    await disconnectRedis();
  });

  it('manager_branch_a_cannot_view_branch_b_orders', async () => {
    const res = await request(app)
      .get('/api/v1/orders/admin/list')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();

    const orders = res.body.data as any[];
    for (const order of orders) {
      expect(order).not.toHaveProperty('branchId', branchBId);
    }
  });

  it('manager_branch_a_cannot_view_branch_b_reviews', async () => {
    const res = await request(app)
      .get('/api/v1/admin/reviews')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();

    const reviews = res.body.data as any[];
    for (const review of reviews) {
      expect(review).not.toHaveProperty('branchId', branchBId);
    }
  });

  it('manager_branch_a_cannot_view_branch_b_inventory', async () => {
    const res = await request(app)
      .get(`/api/v1/branches/${branchBId}/analytics/inventory`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(403);
  });

  it('manager_branch_a_cannot_view_branch_b_customers', async () => {
    const res = await request(app)
      .get(`/api/v1/branches/${branchBId}/analytics/customers`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(403);
  });
});
