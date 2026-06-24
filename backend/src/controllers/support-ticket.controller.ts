import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { supportTicketService } from '../services/support-ticket.service';
import { sendSuccess } from '../utils/response';
import { SupportTicketStatus } from '@prisma/client';

export class SupportTicketController {
  create = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const ticket = await supportTicketService.create(userId, req.body);
      sendSuccess(res, 'Support ticket created successfully.', ticket, {}, 201);
    } catch (err) {
      next(err);
    }
  };

  listMy = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await supportTicketService.listMyTickets(
        req.user!.userId,
        page,
        limit
      );
      sendSuccess(res, 'Tickets retrieved successfully.', result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  };

  adminList = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const status = req.query.status as SupportTicketStatus | undefined;
      const result = await supportTicketService.adminList(page, limit, status);
      sendSuccess(res, 'Tickets retrieved successfully.', result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const ticket = await supportTicketService.updateStatus(
        req.params.id,
        req.body.status as SupportTicketStatus
      );
      sendSuccess(res, 'Ticket status updated successfully.', ticket);
    } catch (err) {
      next(err);
    }
  };
}

export const supportTicketController = new SupportTicketController();
