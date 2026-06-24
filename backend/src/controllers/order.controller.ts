import { Request, Response, NextFunction } from 'express';
import { orderService } from '../services/order.service';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth';
import { OrderStatus } from '@prisma/client';

export class OrderController {
  createOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.userId;
      const { cartId, customerName, customerEmail, customerPhone, reservationId } =
        req.body;

      const order = await orderService.createOrderFromCart(
        cartId,
        { customerName, customerEmail, customerPhone, reservationId },
        userId
      );

      res.status(201).json({
        success: true,
        message: 'Order created successfully from cart.',
        data: order,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  };

  getOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const order = await orderService.getOrder(req.params.id);
      sendSuccess(res, 'Order retrieved successfully.', order);
    } catch (err) {
      next(err);
    }
  };

  getOrderByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const order = await orderService.getOrderByNumber(req.params.orderNumber);
      sendSuccess(res, 'Order retrieved successfully by order number.', order);
    } catch (err) {
      next(err);
    }
  };

  listOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = req.query.status as OrderStatus | undefined;
      const search = req.query.search as string | undefined;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const authReq = req as AuthenticatedRequest;
      const branchScope = authReq.user ? req.branchScope : undefined;
      const branchIds =
        branchScope === undefined || branchScope === null ? undefined : branchScope;

      const result = await orderService.listOrders({
        status,
        search,
        page,
        limit,
        branchIds,
      });
      sendSuccess(res, 'Orders retrieved successfully.', result.items, {
        page,
        limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  };

  listUserOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await orderService.listUserOrders(userId, { page, limit });
      sendSuccess(res, 'User orders retrieved successfully.', result.items, {
        page,
        limit,
        total: result.total,
      });
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
      const authReq = req as AuthenticatedRequest;
      const changedBy = authReq.user?.email || 'admin';
      const { status } = req.body;
      const updated = await orderService.updateOrderStatus(
        req.params.id,
        status,
        changedBy
      );
      sendSuccess(res, 'Order status updated successfully.', updated);
    } catch (err) {
      next(err);
    }
  };

  getStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await orderService.getOrderStats();
      sendSuccess(res, 'Order statistics retrieved successfully.', stats);
    } catch (err) {
      next(err);
    }
  };
}

export const orderController = new OrderController();
