import { Request, Response, NextFunction } from 'express';
import { kitchenService } from '../services/kitchen.service';
import { fulfillmentService } from '../services/fulfillment.service';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth';
import { TicketPriority } from '@prisma/client';

export class KitchenController {
  listTickets = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const stationId = req.query.stationId as string | undefined;
      const status = req.query.status as 'active' | 'pending' | 'completed' | undefined;
      const priority = req.query.priority as TicketPriority | undefined;
      const branchScope = (req as any).user ? req.branchScope : undefined;
      const branchIds =
        branchScope === undefined || branchScope === null ? undefined : branchScope;

      const result = await kitchenService.listTickets({
        stationId,
        status,
        priority,
        page,
        limit,
        branchIds,
      });

      sendSuccess(res, 'Kitchen tickets retrieved successfully.', result.items, {
        page,
        limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  };

  getTicket = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ticket = await kitchenService.getTicket(req.params.id);
      sendSuccess(res, 'Kitchen ticket retrieved successfully.', ticket);
    } catch (err) {
      next(err);
    }
  };

  startTicket = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const changedBy = authReq.user?.email || 'kitchen';
      const ticketId = req.body.ticketId || req.params.id;

      const ticket = await kitchenService.getTicket(ticketId);
      const result = await fulfillmentService.startPreparing(
        ticket.orderId,
        ticketId,
        changedBy
      );
      sendSuccess(res, 'Preparation started successfully.', result);
    } catch (err) {
      next(err);
    }
  };

  completeTicket = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const changedBy = authReq.user?.email || 'kitchen';
      const ticketId = req.body.ticketId || req.params.id;

      const ticket = await kitchenService.getTicket(ticketId);
      const result = await fulfillmentService.markReady(
        ticket.orderId,
        ticketId,
        changedBy
      );
      sendSuccess(res, 'Preparation completed successfully.', result);
    } catch (err) {
      next(err);
    }
  };

  updatePriority = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const ticket = await kitchenService.updatePriority(
        req.params.id,
        req.body.priority
      );
      sendSuccess(res, 'Ticket priority updated successfully.', ticket);
    } catch (err) {
      next(err);
    }
  };

  assignStation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const ticket = await kitchenService.assignStation(
        req.params.id,
        req.body.stationId
      );
      sendSuccess(res, 'Station assigned successfully.', ticket);
    } catch (err) {
      next(err);
    }
  };
}

export const kitchenController = new KitchenController();
