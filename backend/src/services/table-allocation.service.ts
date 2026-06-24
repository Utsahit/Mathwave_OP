import { prisma } from '../config/prisma';
import { AppError } from '../utils/app-error';

interface TableAllocationInput {
  date: string;
  timeSlot: string;
  guestCount: number;
}

/**
 * Table Allocation Service
 *
 * Implements a smallest-fit-first bin-packing algorithm:
 * 1. Fetch all active, non-deleted tables with capacity >= guestCount
 * 2. Sort ascending by capacity (minimize wasted seats)
 * 3. Exclude tables already reserved for the requested slot
 * 4. Return the first (smallest) available table
 *
 * This minimises seat waste — e.g. a party of 2 gets a 2-seat table,
 * not a 6-seat table that could serve a larger party.
 */
export class TableAllocationService {
  async allocate(input: TableAllocationInput) {
    const { date, timeSlot, guestCount } = input;

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    // Step 1: Find all reservations in this slot (non-cancelled)
    const occupied = await prisma.reservation.findMany({
      where: {
        date: { gte: dayStart, lte: dayEnd },
        timeSlot,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        tableId: { not: null },
      },
      select: { tableId: true },
    });

    const occupiedIds = occupied
      .map((r) => r.tableId)
      .filter((id): id is string => id !== null);

    // Step 2: Find smallest-fit available table
    const candidates = await prisma.table.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        capacity: { gte: guestCount },
        ...(occupiedIds.length > 0 ? { id: { notIn: occupiedIds } } : {}),
      },
      orderBy: { capacity: 'asc' }, // Smallest fitting table first
    });

    if (candidates.length === 0) {
      throw new AppError(
        `No available table found for ${guestCount} guests on ${date} at ${timeSlot}.`,
        409,
        'NO_TABLE_AVAILABLE'
      );
    }

    return candidates[0]; // Best fit: smallest table that fits the party
  }
}

export const tableAllocationService = new TableAllocationService();
