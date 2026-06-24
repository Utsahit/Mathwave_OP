import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { ReservationStatus } from '@prisma/client';
import { reservationRepository } from '../repositories/reservation.repository';
import { notificationService } from './notification.service';
import { auditService } from './audit.service';
import { reservationLockService } from './reservation-lock.service';
import { tableAllocationService } from './table-allocation.service';
import { mailService } from './mail.service';
import { whatsappService } from './whatsapp.service';
import { getRedisClient } from '../config/redis';
import { AppError } from '../utils/app-error';
import { logger } from '../config/logger';

// ── Status Transition Rules ────────────────────────────────────────────────────
const ALLOWED_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SEATED', 'CANCELLED', 'NO_SHOW'],
  SEATED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

// ── Cache Helpers ─────────────────────────────────────────────────────────────
const AVAILABILITY_TTL = 300; // 5 minutes

function availabilityCacheKey(date: string, timeSlot: string, guestCount: number) {
  return `availability:${date}:${timeSlot}:${guestCount}`;
}

async function invalidateAvailabilityCache(date: string, timeSlot: string) {
  try {
    const redis = getRedisClient();
    // Pattern-delete all guest-count variants for this slot
    const keys = await redis.keys(`availability:${date}:${timeSlot}:*`);
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // Non-critical — cache will expire naturally
  }
}

// ── Reservation Code Generator ────────────────────────────────────────────────
function generateReservationCode(): string {
  const year = new Date().getFullYear();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `RES-${year}-${suffix}`;
}

export class ReservationService {
  // ── Table Management ───────────────────────────────────────────────────────

  async createTable(data: {
    number: string;
    capacity: number;
    location?: string;
    isActive?: boolean;
  }) {
    const existing = await reservationRepository.findTableByNumber(data.number);
    if (existing) {
      throw new AppError(
        `Table number "${data.number}" already exists.`,
        409,
        'DUPLICATE_TABLE_NUMBER'
      );
    }
    return reservationRepository.createTable({
      number: data.number,
      capacity: data.capacity,
      location: data.location,
      isActive: data.isActive !== undefined ? data.isActive : true,
    });
  }

  async getTable(id: string) {
    const table = await reservationRepository.findTableById(id);
    if (!table) throw new AppError('Table not found.', 404, 'TABLE_NOT_FOUND');
    return table;
  }

  async updateTable(
    id: string,
    data: { number?: string; capacity?: number; location?: string; isActive?: boolean }
  ) {
    await this.getTable(id);

    if (data.number) {
      const conflict = await reservationRepository.findTableByNumber(data.number);
      if (conflict && conflict.id !== id) {
        throw new AppError(
          `Table number "${data.number}" is already in use.`,
          409,
          'DUPLICATE_TABLE_NUMBER'
        );
      }
    }

    return reservationRepository.updateTable(id, data);
  }

  async deleteTable(id: string) {
    await this.getTable(id);
    return reservationRepository.softDeleteTable(id);
  }

  async listTables(filters: {
    search?: string;
    isActive?: boolean;
    sortBy: 'number' | 'capacity' | 'createdAt';
    order: 'asc' | 'desc';
    page: number;
    limit: number;
  }) {
    return reservationRepository.listTables(filters);
  }

  // ── Availability Engine ────────────────────────────────────────────────────

  async checkAvailability(date: string, timeSlot: string, guestCount: number) {
    const cacheKey = availabilityCacheKey(date, timeSlot, guestCount);

    try {
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      // Proceed to DB
    }

    const availableTables = await reservationRepository.findAvailableTables(
      date,
      timeSlot,
      guestCount
    );

    const result = { availableTables };

    try {
      const redis = getRedisClient();
      await redis.set(cacheKey, JSON.stringify(result), 'EX', AVAILABILITY_TTL);
    } catch {
      // Non-critical
    }

    return result;
  }

  // ── Reservation Create (Public) ────────────────────────────────────────────

  async createReservation(data: {
    name: string;
    email: string;
    phone: string;
    date: string;
    timeSlot: string;
    guests: number;
    specialRequest?: string;
    tableId?: string;
    customerId?: string;
  }) {
    // Step 1: Resolve table (auto-assign if not provided)
    let resolvedTableId = data.tableId;

    if (resolvedTableId) {
      // Validate supplied table exists and is active
      const table = await reservationRepository.findTableById(resolvedTableId);
      if (!table)
        throw new AppError('Specified table not found.', 404, 'TABLE_NOT_FOUND');
      if (!table.isActive)
        throw new AppError('Specified table is not available.', 409, 'TABLE_INACTIVE');
      if (table.capacity < data.guests)
        throw new AppError(
          `Table capacity (${table.capacity}) is less than guest count (${data.guests}).`,
          409,
          'CAPACITY_EXCEEDED'
        );
    } else {
      // Auto-assign smallest fitting table
      const assigned = await tableAllocationService.allocate({
        date: data.date,
        timeSlot: data.timeSlot,
        guestCount: data.guests,
      });
      resolvedTableId = assigned.id;
    }

    // Step 2: Acquire Redis distributed lock for this slot
    const lockToken = await reservationLockService.acquireLock(
      data.date,
      data.timeSlot,
      resolvedTableId
    );

    if (lockToken === null) {
      throw new AppError(
        'This table slot is currently being reserved by another request. Please try again.',
        409,
        'SLOT_LOCKED'
      );
    }

    try {
      // Step 3: Transactional double-booking check + create
      const reservation = await prisma.$transaction(async (tx) => {
        const available = await reservationRepository.isTableAvailableInTx(
          tx,
          resolvedTableId!,
          data.date,
          data.timeSlot
        );

        if (!available) {
          throw new AppError(
            'This table is no longer available for the requested slot.',
            409,
            'DOUBLE_BOOKING'
          );
        }

        const code = generateReservationCode();

        return tx.reservation.create({
          data: {
            reservationCode: code,
            name: data.name,
            email: data.email,
            phone: data.phone,
            date: new Date(`${data.date}T00:00:00.000Z`),
            timeSlot: data.timeSlot,
            guests: data.guests,
            specialRequest: data.specialRequest,
            tableId: resolvedTableId,
            customerId: data.customerId || null,
          },
          include: {
            table: true,
            customer: { select: { id: true, name: true, email: true } },
          },
        });
      });

      // Step 4: Invalidate availability cache for this slot
      await invalidateAvailabilityCache(data.date, data.timeSlot);

      // Notification for new reservation
      if (reservation.customerId) {
        notificationService
          .create(
            reservation.customerId,
            null,
            'RESERVATION_CREATED',
            'Reservation Created',
            `Reservation ${reservation.reservationCode} has been created.`,
            'IN_APP',
            { reservationId: reservation.id }
          )
          .catch(() => {});
      }
      auditService
        .logCreate(null, 'Reservation', reservation.id, {
          reservationCode: reservation.reservationCode,
        })
        .catch(() => {});

      // Step 5: Send confirmation email (non-blocking)
      mailService
        .sendReservationConfirmation({
          name: reservation.name,
          email: reservation.email,
          reservationCode: reservation.reservationCode,
          date: data.date,
          timeSlot: reservation.timeSlot,
          guests: reservation.guests,
          tableNumber: reservation.table?.number,
          specialRequest: reservation.specialRequest,
        })
        .catch((err) =>
          logger.error({ err }, 'Confirmation email fire-and-forget failed.')
        );

      const dateStr = data.date;
      return {
        ...reservation,
        whatsappLink: whatsappService.generateReservationLink(
          reservation.reservationCode,
          reservation.name,
          dateStr,
          reservation.timeSlot,
          reservation.guests
        ),
      };
    } finally {
      // Always release the lock
      await reservationLockService.releaseLock(
        data.date,
        data.timeSlot,
        resolvedTableId!,
        lockToken
      );
    }
  }

  // ── Reservation Read ───────────────────────────────────────────────────────

  async getReservation(id: string) {
    const reservation = await reservationRepository.findReservationById(id);
    if (!reservation)
      throw new AppError('Reservation not found.', 404, 'RESERVATION_NOT_FOUND');
    return reservation;
  }

  async listReservations(filters: {
    status?: ReservationStatus;
    date?: string;
    search?: string;
    page: number;
    limit: number;
    branchIds?: string[];
  }) {
    return reservationRepository.listReservations(filters);
  }

  // ── Reservation Status Transition ─────────────────────────────────────────

  async updateStatus(id: string, newStatus: ReservationStatus) {
    const reservation = await this.getReservation(id);
    const current = reservation.status;
    const allowed = ALLOWED_TRANSITIONS[current];

    if (!allowed.includes(newStatus)) {
      throw new AppError(
        `Invalid status transition: ${current} → ${newStatus}. Allowed: ${allowed.join(', ') || 'none'}.`,
        422,
        'INVALID_TRANSITION'
      );
    }

    const updated = await reservationRepository.updateReservation(id, {
      status: newStatus,
    });

    if (updated.customerId) {
      if (newStatus === 'CONFIRMED') {
        notificationService
          .create(
            updated.customerId,
            null,
            'RESERVATION_CONFIRMED',
            'Reservation Confirmed',
            `Reservation ${updated.reservationCode} has been confirmed.`,
            'IN_APP',
            { reservationId: updated.id }
          )
          .catch(() => {});
      } else if (newStatus === 'CANCELLED') {
        notificationService
          .create(
            updated.customerId,
            null,
            'RESERVATION_CANCELLED',
            'Reservation Cancelled',
            `Reservation ${updated.reservationCode} has been cancelled.`,
            'IN_APP',
            { reservationId: updated.id }
          )
          .catch(() => {});
      }
    }
    auditService
      .logStatusChange(null, 'Reservation', id, current, newStatus)
      .catch(() => {});

    // Invalidate availability when cancelled or marked no-show (frees the slot)
    if (newStatus === 'CANCELLED' || newStatus === 'NO_SHOW') {
      const dateStr = updated.date.toISOString().split('T')[0];
      await invalidateAvailabilityCache(dateStr, updated.timeSlot);

      // Send cancellation email
      mailService
        .sendReservationCancellation({
          name: updated.name,
          email: updated.email,
          reservationCode: updated.reservationCode,
          date: dateStr,
          timeSlot: updated.timeSlot,
          guests: updated.guests,
        })
        .catch((err) =>
          logger.error({ err }, 'Cancellation email fire-and-forget failed.')
        );
    }

    return updated;
  }

  // ── Reservation Update ─────────────────────────────────────────────────────

  async updateReservation(
    id: string,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      date?: string;
      timeSlot?: string;
      guests?: number;
      specialRequest?: string;
      tableId?: string;
    }
  ) {
    const existing = await this.getReservation(id);

    // Only allow updates on PENDING reservations
    if (!['PENDING', 'CONFIRMED'].includes(existing.status)) {
      throw new AppError(
        'Only PENDING or CONFIRMED reservations can be updated.',
        422,
        'INVALID_UPDATE'
      );
    }

    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;
    if (data.phone) updateData.phone = data.phone;
    if (data.specialRequest !== undefined)
      updateData.specialRequest = data.specialRequest;
    if (data.date) updateData.date = new Date(`${data.date}T00:00:00.000Z`);
    if (data.timeSlot) updateData.timeSlot = data.timeSlot;
    if (data.guests) updateData.guests = data.guests;
    if (data.tableId) updateData.tableId = data.tableId;

    const updated = await reservationRepository.updateReservation(id, updateData);

    // Invalidate cache for both old and new slots
    const oldDate = existing.date.toISOString().split('T')[0];
    await invalidateAvailabilityCache(oldDate, existing.timeSlot);
    if (data.date || data.timeSlot) {
      const newDate = data.date || oldDate;
      const newSlot = data.timeSlot || existing.timeSlot;
      await invalidateAvailabilityCache(newDate, newSlot);
    }

    return updated;
  }

  // ── Reservation Delete (Soft via CANCELLED status) ─────────────────────────

  async deleteReservation(id: string) {
    const reservation = await this.getReservation(id);

    if (['COMPLETED', 'CANCELLED'].includes(reservation.status)) {
      throw new AppError(
        'Cannot delete a COMPLETED or already CANCELLED reservation.',
        422,
        'INVALID_DELETE'
      );
    }

    return this.updateStatus(id, 'CANCELLED');
  }
}

export const reservationService = new ReservationService();
