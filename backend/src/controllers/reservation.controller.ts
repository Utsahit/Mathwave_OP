import { Request, Response, NextFunction } from 'express';
import { reservationService } from '../services/reservation.service';
import { sendSuccess } from '../utils/response';
import { ReservationStatus } from '@prisma/client';

export class ReservationController {
  // ── Table Controllers ──────────────────────────────────────────────────────

  createTable = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const table = await reservationService.createTable(req.body);
      sendSuccess(res, 'Table created successfully.', table, {}, 201);
    } catch (err) {
      next(err);
    }
  };

  listTables = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // req.query is already coerced by Zod validate middleware
      const page = (req.query.page as unknown as number) || 1;
      const limit = (req.query.limit as unknown as number) || 20;
      const search = req.query.search as string | undefined;
      const isActive = req.query.isActive as boolean | undefined;
      const sortBy =
        (req.query.sortBy as 'number' | 'capacity' | 'createdAt') || 'number';
      const order = (req.query.order as 'asc' | 'desc') || 'asc';

      const { items, total } = await reservationService.listTables({
        search,
        isActive,
        sortBy,
        order,
        page,
        limit,
      });

      sendSuccess(res, 'Tables listed successfully.', items, { page, limit, total });
    } catch (err) {
      next(err);
    }
  };

  getTable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const table = await reservationService.getTable(req.params.id);
      sendSuccess(res, 'Table retrieved successfully.', table);
    } catch (err) {
      next(err);
    }
  };

  updateTable = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const table = await reservationService.updateTable(req.params.id, req.body);
      sendSuccess(res, 'Table updated successfully.', table);
    } catch (err) {
      next(err);
    }
  };

  deleteTable = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await reservationService.deleteTable(req.params.id);
      sendSuccess(res, 'Table deleted successfully.');
    } catch (err) {
      next(err);
    }
  };

  // ── Availability Controller ────────────────────────────────────────────────

  checkAvailability = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const date = req.query.date as string;
      const timeSlot = req.query.timeSlot as string;
      const guestCount = Number(req.query.guestCount);

      const data = await reservationService.checkAvailability(date, timeSlot, guestCount);
      sendSuccess(res, 'Availability retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  // ── Reservation Controllers ────────────────────────────────────────────────

  createReservation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const reservation = await reservationService.createReservation(req.body);
      sendSuccess(res, 'Reservation created successfully.', reservation, {}, 201);
    } catch (err) {
      next(err);
    }
  };

  listReservations = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const status = req.query.status as ReservationStatus | undefined;
      const date = req.query.date as string | undefined;
      const search = req.query.search as string | undefined;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const branchScope = (req as any).user ? req.branchScope : undefined;
      const branchIds =
        branchScope === undefined || branchScope === null ? undefined : branchScope;

      const { items, total } = await reservationService.listReservations({
        status,
        date,
        search,
        page,
        limit,
        branchIds,
      });

      sendSuccess(res, 'Reservations retrieved successfully.', items, {
        page,
        limit,
        total,
      });
    } catch (err) {
      next(err);
    }
  };

  getReservation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const reservation = await reservationService.getReservation(req.params.id);
      sendSuccess(res, 'Reservation retrieved successfully.', reservation);
    } catch (err) {
      next(err);
    }
  };

  updateReservation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const reservation = await reservationService.updateReservation(
        req.params.id,
        req.body
      );
      sendSuccess(res, 'Reservation updated successfully.', reservation);
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { status } = req.body as { status: ReservationStatus };
      const reservation = await reservationService.updateStatus(req.params.id, status);
      sendSuccess(res, 'Reservation status updated successfully.', reservation);
    } catch (err) {
      next(err);
    }
  };

  deleteReservation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const reservation = await reservationService.deleteReservation(req.params.id);
      sendSuccess(res, 'Reservation cancelled successfully.', reservation);
    } catch (err) {
      next(err);
    }
  };
}

export const reservationController = new ReservationController();
