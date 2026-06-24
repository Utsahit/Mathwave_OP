import { Router } from 'express';
import { reservationController } from '../controllers/reservation.controller';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { branchScopeMiddleware } from '../middleware/branch-context';
import { reservationLimiter } from '../middleware/rate-limiter';
import {
  createTableSchema,
  updateTableSchema,
  tableQuerySchema,
  createReservationSchema,
  updateReservationSchema,
  updateStatusSchema,
  availabilityQuerySchema,
  reservationQuerySchema,
} from '../validators/reservation.validator';

const router = Router();

// ── Availability (Public) ──────────────────────────────────────────────────────
// Must be declared before /reservations/:id to avoid route collision
router.get(
  '/reservations/availability',
  validate({ query: availabilityQuerySchema }),
  reservationController.checkAvailability
);

// ── Public Reservation Create ──────────────────────────────────────────────────
router.post(
  '/reservations',
  reservationLimiter,
  validate({ body: createReservationSchema }),
  reservationController.createReservation
);

// ── Admin Reservation Endpoints ────────────────────────────────────────────────
router.get(
  '/reservations',
  requireAuth(),
  requirePermission('reservation:view'),
  branchScopeMiddleware,
  validate({ query: reservationQuerySchema }),
  reservationController.listReservations
);

router.get(
  '/reservations/:id',
  requireAuth(),
  requirePermission('reservation:view'),
  reservationController.getReservation
);

router.put(
  '/reservations/:id',
  requireAuth(),
  requirePermission('reservation:update'),
  validate({ body: updateReservationSchema }),
  reservationController.updateReservation
);

router.put(
  '/reservations/:id/status',
  requireAuth(),
  requirePermission('reservation:update'),
  validate({ body: updateStatusSchema }),
  reservationController.updateStatus
);

router.delete(
  '/reservations/:id',
  requireAuth(),
  requirePermission('reservation:delete'),
  reservationController.deleteReservation
);

// ── Table Endpoints (Admin Only) ───────────────────────────────────────────────
router.post(
  '/tables',
  requireAuth(),
  requirePermission('table:create'),
  validate({ body: createTableSchema }),
  reservationController.createTable
);

router.get(
  '/tables',
  validate({ query: tableQuerySchema }),
  reservationController.listTables
);

router.get('/tables/:id', reservationController.getTable);

router.put(
  '/tables/:id',
  requireAuth(),
  requirePermission('table:update'),
  validate({ body: updateTableSchema }),
  reservationController.updateTable
);

router.delete(
  '/tables/:id',
  requireAuth(),
  requirePermission('table:delete'),
  reservationController.deleteTable
);

export default router;
