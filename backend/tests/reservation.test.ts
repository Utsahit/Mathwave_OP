import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { getRedisClient, disconnectRedis } from '../src/config/redis';
import { disconnectPrisma } from '../src/config/prisma';
import { mailService } from '../src/services/mail.service';

jest.setTimeout(30000);

// Mock mail service so SMTP never actually fires during tests
jest.mock('../src/services/mail.service', () => ({
  mailService: {
    sendReservationConfirmation: jest.fn().mockResolvedValue(undefined),
    sendReservationCancellation: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockedMail = mailService as jest.Mocked<typeof mailService>;

describe('Phase 6 — Reservation & Table Management Integration Suite', () => {
  let adminToken: string;
  let staffToken: string;
  let customerToken: string;

  // IDs created during tests
  let testTableId: string;
  let testTableNumber: string;
  let reservationId: string;
  let reservationCode: string;

  // Fixed slot used for double-booking tests
  const TEST_DATE = '2099-12-25';
  const TEST_SLOT = '19:00';

  beforeAll(async () => {
    const redis = getRedisClient();
    if (redis.status === 'ready') await redis.flushall();

    // Login admin
    const adminRes = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@elixirandoak.in',
      password: 'Password123!',
    });
    adminToken = adminRes.body.data.accessToken;

    // Login staff
    const staffRes = await request(app).post('/api/v1/auth/login').send({
      email: 'staff@elixirandoak.in',
      password: 'Password123!',
    });
    staffToken = staffRes.body.data.accessToken;

    // Login customer
    const customerRes = await request(app).post('/api/v1/auth/login').send({
      email: 'customer@elixirandoak.in',
      password: 'Password123!',
    });
    customerToken = customerRes.body.data.accessToken;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.reservation.deleteMany({
      where: { date: { gte: new Date('2099-01-01') } },
    });
    await prisma.table.deleteMany({
      where: { number: { startsWith: 'TEST-' } },
    });

    await disconnectRedis();
    await disconnectPrisma();
  });

  // ── 1. TABLE CRUD ──────────────────────────────────────────────────────────

  describe('1. Table CRUD', () => {
    it('should create a table as Admin (201)', async () => {
      testTableNumber = `TEST-${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/tables')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          number: testTableNumber,
          capacity: 4,
          location: 'Indoor',
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.number).toBe(testTableNumber);
      expect(res.body.data.capacity).toBe(4);
      expect(res.body.data.location).toBe('Indoor');
      expect(res.body.data.isActive).toBe(true);
      testTableId = res.body.data.id;
    });

    it('should reject duplicate table number (409)', async () => {
      const res = await request(app)
        .post('/api/v1/tables')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ number: testTableNumber, capacity: 2 });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DUPLICATE_TABLE_NUMBER');
    });

    it('should block customer from creating table (403)', async () => {
      const res = await request(app)
        .post('/api/v1/tables')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ number: 'BLOCKED-1', capacity: 2 });

      expect(res.status).toBe(403);
    });

    it('should list tables with pagination (200)', async () => {
      const res = await request(app).get('/api/v1/tables').query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    });

    it('should get a single table by ID (200)', async () => {
      const res = await request(app).get(`/api/v1/tables/${testTableId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testTableId);
    });

    it('should return 404 for non-existent table', async () => {
      const res = await request(app).get(
        '/api/v1/tables/00000000-0000-0000-0000-000000000000'
      );
      expect(res.status).toBe(404);
    });

    it('should update a table as Admin (200)', async () => {
      const res = await request(app)
        .put(`/api/v1/tables/${testTableId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ location: 'Terrace', capacity: 6 });

      expect(res.status).toBe(200);
      expect(res.body.data.location).toBe('Terrace');
      expect(res.body.data.capacity).toBe(6);
    });

    it('should filter tables by isActive=true (200)', async () => {
      const res = await request(app).get('/api/v1/tables').query({ isActive: 'true' });

      expect(res.status).toBe(200);
      res.body.data.forEach((t: { isActive: boolean }) => {
        expect(t.isActive).toBe(true);
      });
    });
  });

  // ── 2. AVAILABILITY ENGINE ─────────────────────────────────────────────────

  describe('2. Availability Engine', () => {
    it('should return available tables for a future slot (200)', async () => {
      const res = await request(app)
        .get('/api/v1/reservations/availability')
        .query({ date: TEST_DATE, timeSlot: TEST_SLOT, guestCount: 2 });

      expect(res.status).toBe(200);
      expect(res.body.data.availableTables).toBeInstanceOf(Array);
      expect(res.body.data.availableTables.length).toBeGreaterThan(0);
      // All returned tables must have capacity >= 2
      res.body.data.availableTables.forEach((t: { capacity: number }) => {
        expect(t.capacity).toBeGreaterThanOrEqual(2);
      });
    });

    it('should return no tables when guestCount exceeds all capacities', async () => {
      const res = await request(app)
        .get('/api/v1/reservations/availability')
        .query({ date: TEST_DATE, timeSlot: TEST_SLOT, guestCount: 9999 });

      expect(res.status).toBe(200);
      expect(res.body.data.availableTables).toHaveLength(0);
    });

    it('should reject missing parameters (400)', async () => {
      const res = await request(app)
        .get('/api/v1/reservations/availability')
        .query({ date: TEST_DATE });

      expect(res.status).toBe(400);
    });
  });

  // ── 3. PUBLIC RESERVATION CREATE (with auto-assign) ────────────────────────

  describe('3. Public Reservation Create', () => {
    it('should create a reservation without auth — auto-assigns table (201)', async () => {
      const res = await request(app).post('/api/v1/reservations').send({
        name: 'Test Guest',
        email: 'guest@test.com',
        phone: '+91 98000 00001',
        date: TEST_DATE,
        timeSlot: TEST_SLOT,
        guests: 2,
        specialRequest: 'Window seat preferred.',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reservationCode).toMatch(/^RES-\d{4}-[A-F0-9]{6}$/);
      expect(res.body.data.tableId).toBeTruthy(); // auto-assigned
      expect(res.body.data.customerId).toBeNull(); // guest booking
      expect(res.body.data.specialRequest).toBe('Window seat preferred.');

      reservationId = res.body.data.id;
      reservationCode = res.body.data.reservationCode;

      // Confirm email mock was called
      expect(mockedMail.sendReservationConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({ reservationCode })
      );
    });

    it('should create a reservation with explicit tableId (201)', async () => {
      const res = await request(app).post('/api/v1/reservations').send({
        name: 'Explicit Table Guest',
        email: 'explicit@test.com',
        phone: '+91 98000 00002',
        date: TEST_DATE,
        timeSlot: '20:00',
        guests: 2,
        tableId: testTableId,
      });

      expect(res.status).toBe(201);
      expect(res.body.data.tableId).toBe(testTableId);
    });

    it('should reject reservation with non-existent tableId (404)', async () => {
      const res = await request(app).post('/api/v1/reservations').send({
        name: 'Bad Table Guest',
        email: 'bad@test.com',
        phone: '+91 98000 00003',
        date: TEST_DATE,
        timeSlot: '21:00',
        guests: 2,
        tableId: '00000000-0000-0000-0000-000000000000',
      });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('TABLE_NOT_FOUND');
    });

    it('should reject reservation when no table fits guestCount (409)', async () => {
      const res = await request(app).post('/api/v1/reservations').send({
        name: 'Overflow Guest',
        email: 'overflow@test.com',
        phone: '+91 98000 00004',
        date: TEST_DATE,
        timeSlot: '22:00',
        guests: 9999,
      });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('NO_TABLE_AVAILABLE');
    });

    it('should reject invalid email (400)', async () => {
      const res = await request(app).post('/api/v1/reservations').send({
        name: 'Bad Email',
        email: 'not-an-email',
        phone: '+91 98000 00005',
        date: TEST_DATE,
        timeSlot: '22:00',
        guests: 2,
      });

      expect(res.status).toBe(400);
    });
  });

  // ── 4. DOUBLE BOOKING PREVENTION ──────────────────────────────────────────

  describe('4. Double Booking Prevention', () => {
    it('should prevent double booking same table in same slot (409)', async () => {
      // First booking was already created in section 3 for TEST_DATE / TEST_SLOT
      // Now we find which table was auto-assigned and try to book it again
      const firstRes = await request(app)
        .get(`/api/v1/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const assignedTableId = firstRes.body.data.tableId;

      const doubleBookRes = await request(app).post('/api/v1/reservations').send({
        name: 'Double Booker',
        email: 'double@test.com',
        phone: '+91 98000 00010',
        date: TEST_DATE,
        timeSlot: TEST_SLOT,
        guests: 1,
        tableId: assignedTableId,
      });

      expect(doubleBookRes.status).toBe(409);
      expect(['DOUBLE_BOOKING', 'SLOT_LOCKED']).toContain(doubleBookRes.body.code);
    });
  });

  // ── 5. ADMIN RESERVATION MANAGEMENT ───────────────────────────────────────

  describe('5. Admin Reservation Management', () => {
    it('should list all reservations as Admin (200)', async () => {
      const res = await request(app)
        .get('/api/v1/reservations')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    });

    it('should filter reservations by date (200)', async () => {
      const res = await request(app)
        .get('/api/v1/reservations')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ date: TEST_DATE });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter reservations by status (200)', async () => {
      const res = await request(app)
        .get('/api/v1/reservations')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ status: 'PENDING' });

      expect(res.status).toBe(200);
      res.body.data.forEach((r: { status: string }) => {
        expect(r.status).toBe('PENDING');
      });
    });

    it('should get single reservation by ID as Admin (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.reservationCode).toBe(reservationCode);
    });

    it('should block customer from listing reservations (403)', async () => {
      const res = await request(app)
        .get('/api/v1/reservations')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow staff to list reservations (200)', async () => {
      const res = await request(app)
        .get('/api/v1/reservations')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ── 6. STATUS WORKFLOW ────────────────────────────────────────────────────

  describe('6. Status Workflow', () => {
    it('PENDING → CONFIRMED (valid transition)', async () => {
      const res = await request(app)
        .put(`/api/v1/reservations/${reservationId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CONFIRMED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CONFIRMED');
    });

    it('CONFIRMED → PENDING (invalid transition → 422)', async () => {
      const res = await request(app)
        .put(`/api/v1/reservations/${reservationId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'PENDING' });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('INVALID_TRANSITION');
    });

    it('CONFIRMED → SEATED (valid transition)', async () => {
      const res = await request(app)
        .put(`/api/v1/reservations/${reservationId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SEATED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SEATED');
    });

    it('SEATED → COMPLETED (valid transition)', async () => {
      const res = await request(app)
        .put(`/api/v1/reservations/${reservationId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'COMPLETED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('COMPLETED');
    });

    it('COMPLETED → CANCELLED (invalid terminal state → 422)', async () => {
      const res = await request(app)
        .put(`/api/v1/reservations/${reservationId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CANCELLED' });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('INVALID_TRANSITION');
    });
  });

  // ── 7. NO-SHOW WORKFLOW ───────────────────────────────────────────────────

  describe('7. No-Show Workflow', () => {
    let noShowReservationId: string;

    it('should create a reservation for no-show test', async () => {
      const res = await request(app).post('/api/v1/reservations').send({
        name: 'No Show Guest',
        email: 'noshow@test.com',
        phone: '+91 98000 00020',
        date: TEST_DATE,
        timeSlot: '09:00',
        guests: 2,
      });

      expect(res.status).toBe(201);
      noShowReservationId = res.body.data.id;
    });

    it('PENDING → CONFIRMED → NO_SHOW (valid workflow)', async () => {
      await request(app)
        .put(`/api/v1/reservations/${noShowReservationId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CONFIRMED' });

      const res = await request(app)
        .put(`/api/v1/reservations/${noShowReservationId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'NO_SHOW' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('NO_SHOW');
      // Cancellation email should fire on NO_SHOW
      expect(mockedMail.sendReservationCancellation).toHaveBeenCalled();
    });
  });

  // ── 8. CANCELLATION ───────────────────────────────────────────────────────

  describe('8. Cancellation', () => {
    let cancelReservationId: string;

    it('should create a reservation for cancellation test', async () => {
      const res = await request(app).post('/api/v1/reservations').send({
        name: 'Cancel Guest',
        email: 'cancel@test.com',
        phone: '+91 98000 00030',
        date: TEST_DATE,
        timeSlot: '10:00',
        guests: 2,
      });

      expect(res.status).toBe(201);
      cancelReservationId = res.body.data.id;
    });

    it('should cancel reservation via DELETE (admin) → sets status CANCELLED', async () => {
      const res = await request(app)
        .delete(`/api/v1/reservations/${cancelReservationId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
      expect(mockedMail.sendReservationCancellation).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'cancel@test.com' })
      );
    });

    it('should not be able to delete an already CANCELLED reservation', async () => {
      const res = await request(app)
        .delete(`/api/v1/reservations/${cancelReservationId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('INVALID_DELETE');
    });
  });

  // ── 9. TABLE SOFT DELETE ──────────────────────────────────────────────────

  describe('9. Table Soft Delete', () => {
    it('should soft-delete a table as Admin (200)', async () => {
      const res = await request(app)
        .delete(`/api/v1/tables/${testTableId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('should return 404 for soft-deleted table', async () => {
      const res = await request(app).get(`/api/v1/tables/${testTableId}`);
      expect(res.status).toBe(404);
    });
  });
});
