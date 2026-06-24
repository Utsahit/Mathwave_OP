import { z } from 'zod';

// ── Shared preprocess helpers ─────────────────────────────────────────────────

/**
 * Safe numeric preprocess: returns undefined when val is absent so that
 * Zod .default() can fire correctly. Prevents Number(undefined) = NaN.
 */
const safeNum = (val: unknown) =>
  val === undefined || val === '' ? undefined : Number(val);

/**
 * Safe boolean preprocess from query string values.
 */
const safeBool = (val: unknown) =>
  val === undefined ? undefined : val === 'true' || val === true;

// ── Table Validators ──────────────────────────────────────────────────────────

export const createTableSchema = z.object({
  number: z.string().min(1, 'Table number is required.').max(20),
  capacity: z.number().int().positive('Capacity must be a positive integer.'),
  location: z.string().max(100).optional(),
  isActive: z.boolean().default(true),
});

export const updateTableSchema = createTableSchema.partial();

export const tableQuerySchema = z.object({
  search: z.string().optional(),
  isActive: z.preprocess(safeBool, z.boolean().optional()),
  sortBy: z.enum(['number', 'capacity', 'createdAt']).default('number'),
  order: z.enum(['asc', 'desc']).default('asc'),
  page: z.preprocess(safeNum, z.number().int().positive().default(1)),
  limit: z.preprocess(safeNum, z.number().int().positive().default(20)),
});

// ── Reservation Validators ────────────────────────────────────────────────────

export const createReservationSchema = z.object({
  name: z.string().min(1, 'Name is required.').max(100),
  email: z.string().email('Invalid email address.'),
  phone: z.string().min(7, 'Phone number too short.').max(20, 'Phone number too long.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.'),
  timeSlot: z.string().regex(/^\d{2}:\d{2}$/, 'Time slot must be in HH:MM format.'),
  // No upper max on guests — table capacity enforcement happens in the service layer
  guests: z.number().int().positive('Guest count must be a positive integer.'),
  specialRequest: z.string().max(500).optional(),
  tableId: z.string().uuid('Invalid table ID.').optional(),
  customerId: z.string().uuid().optional(),
});

export const updateReservationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(20).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  timeSlot: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  guests: z.number().int().positive().optional(),
  specialRequest: z.string().max(500).optional(),
  tableId: z.string().uuid().optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(
    ['PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
    {
      errorMap: () => ({
        message:
          'Status must be one of: PENDING, CONFIRMED, SEATED, COMPLETED, CANCELLED, NO_SHOW.',
      }),
    }
  ),
});

export const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.'),
  timeSlot: z.string().regex(/^\d{2}:\d{2}$/, 'Time slot must be in HH:MM format.'),
  guestCount: z.preprocess(
    safeNum,
    z.number().int().positive('Guest count must be positive.')
  ),
});

export const reservationQuerySchema = z.object({
  status: z
    .enum(['PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
    .optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  search: z.string().optional(),
  page: z.preprocess(safeNum, z.number().int().positive().default(1)),
  limit: z.preprocess(safeNum, z.number().int().positive().default(20)),
});
