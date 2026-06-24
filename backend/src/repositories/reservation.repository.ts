import { prisma } from '../config/prisma';
import { Prisma, ReservationStatus } from '@prisma/client';

export class ReservationRepository {
  // ── Table CRUD ──────────────────────────────────────────────────────────────

  async createTable(data: Prisma.TableCreateInput) {
    return prisma.table.create({ data });
  }

  async findTableById(id: string) {
    return prisma.table.findFirst({ where: { id, isDeleted: false } });
  }

  async findTableByNumber(number: string) {
    return prisma.table.findFirst({ where: { number, isDeleted: false } });
  }

  async updateTable(id: string, data: Prisma.TableUpdateInput) {
    return prisma.table.update({ where: { id }, data });
  }

  async softDeleteTable(id: string) {
    return prisma.table.update({
      where: { id },
      data: { isDeleted: true, isActive: false },
    });
  }

  async listTables(filters: {
    search?: string;
    isActive?: boolean;
    sortBy: 'number' | 'capacity' | 'createdAt';
    order: 'asc' | 'desc';
    page: number;
    limit: number;
  }) {
    const where: Prisma.TableWhereInput = { isDeleted: false };

    if (filters.search) {
      where.OR = [
        { number: { contains: filters.search, mode: 'insensitive' } },
        { location: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      prisma.table.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { [filters.sortBy]: filters.order },
      }),
      prisma.table.count({ where }),
    ]);

    return { items, total };
  }

  async findActiveTables() {
    return prisma.table.findMany({
      where: { isDeleted: false, isActive: true },
      orderBy: { capacity: 'asc' },
    });
  }

  // ── Reservation CRUD ────────────────────────────────────────────────────────

  async createReservation(data: Prisma.ReservationCreateInput) {
    return prisma.reservation.create({
      data,
      include: {
        table: true,
        customer: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findReservationById(id: string) {
    return prisma.reservation.findUnique({
      where: { id },
      include: {
        table: true,
        customer: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findReservationByCode(code: string) {
    return prisma.reservation.findUnique({
      where: { reservationCode: code },
      include: {
        table: { select: { id: true, number: true, capacity: true, location: true } },
      },
    });
  }

  async updateReservation(id: string, data: Prisma.ReservationUpdateInput) {
    return prisma.reservation.update({
      where: { id },
      data,
      include: {
        table: true,
        customer: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async listReservations(filters: {
    status?: ReservationStatus;
    date?: string;
    search?: string;
    page: number;
    limit: number;
    branchIds?: string[];
  }) {
    const where: Prisma.ReservationWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.date) {
      const start = new Date(`${filters.date}T00:00:00.000Z`);
      const end = new Date(`${filters.date}T23:59:59.999Z`);
      where.date = { gte: start, lte: end };
    }

    if (filters.branchIds) {
      where.branchId = { in: filters.branchIds };
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { reservationCode: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { date: 'desc' },
        include: {
          table: { select: { id: true, number: true, capacity: true, location: true } },
          customer: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.reservation.count({ where }),
    ]);

    return { items, total };
  }

  // ── Availability Engine ─────────────────────────────────────────────────────

  async findReservedTableIds(date: string, timeSlot: string): Promise<string[]> {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const reservations = await prisma.reservation.findMany({
      where: {
        date: { gte: dayStart, lte: dayEnd },
        timeSlot,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        tableId: { not: null },
      },
      select: { tableId: true },
    });

    return reservations.map((r) => r.tableId).filter((id): id is string => id !== null);
  }

  /**
   * Finds all available tables for a date/timeSlot/guestCount in a SINGLE Prisma query.
   * Uses NOT reservations.some subquery to avoid app-level JOIN across two round-trips.
   */
  async findAvailableTables(date: string, timeSlot: string, guestCount: number) {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    return prisma.table.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        capacity: { gte: guestCount },
        NOT: {
          reservations: {
            some: {
              date: { gte: dayStart, lte: dayEnd },
              timeSlot,
              status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            },
          },
        },
      },
      orderBy: { capacity: 'asc' },
    });
  }

  // ── Double-booking check inside a transaction ───────────────────────────────

  async isTableAvailableInTx(
    tx: Prisma.TransactionClient,
    tableId: string,
    date: string,
    timeSlot: string
  ): Promise<boolean> {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    // Use select:{id:true} — only existence matters, no need to load full row
    const conflict = await tx.reservation.findFirst({
      where: {
        tableId,
        timeSlot,
        date: { gte: dayStart, lte: dayEnd },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
      select: { id: true },
    });

    return conflict === null;
  }
}

export const reservationRepository = new ReservationRepository();
