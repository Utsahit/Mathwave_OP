import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { purchaseOrderService } from '../services/purchase-order.service';
import { sendSuccess } from '../utils/response';
import { PurchaseOrderStatus } from '@prisma/client';

export class PurchaseOrderController {
  createPurchaseOrder = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const changedBy = req.user?.email || 'admin';
      const po = await purchaseOrderService.createPurchaseOrder(req.body, changedBy);
      res.status(201).json({
        success: true,
        message: 'Purchase order created successfully.',
        data: po,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  };

  getPurchaseOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const po = await purchaseOrderService.getPurchaseOrder(req.params.id);
      sendSuccess(res, 'Purchase order retrieved successfully.', po);
    } catch (err) {
      next(err);
    }
  };

  updatePurchaseOrderStatus = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const changedBy = req.user?.email || 'admin';
      const { status } = req.body;
      const po = await purchaseOrderService.updatePurchaseOrderStatus(
        req.params.id,
        status,
        changedBy
      );
      sendSuccess(res, 'Purchase order status updated successfully.', po);
    } catch (err) {
      next(err);
    }
  };

  listPurchaseOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const status = req.query.status as PurchaseOrderStatus | undefined;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const branchScope = (req as any).user ? req.branchScope : undefined;
      const branchIds =
        branchScope === undefined || branchScope === null ? undefined : branchScope;

      const result = await purchaseOrderService.listPurchaseOrders({
        status,
        page,
        limit,
        branchIds,
      });
      sendSuccess(res, 'Purchase orders retrieved successfully.', result.items, {
        page,
        limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const purchaseOrderController = new PurchaseOrderController();
