import { Request, Response, NextFunction } from 'express';
import { inventoryTransferService } from '../services/inventory-transfer.service';
import { AppError } from '../utils/app-error';
import { sendSuccess } from '../utils/response';

export class InventoryTransferController {
  createTransfer = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const adminUserId = (req as any).user?.userId;
      if (!adminUserId) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }
      const { fromBranchId, toBranchId, items } = req.body;
      const result = await inventoryTransferService.createTransfer(
        fromBranchId,
        toBranchId,
        items,
        adminUserId
      );
      sendSuccess(res, 'Inventory transfer created successfully.', result, {}, 201);
    } catch (error) {
      next(error);
    }
  };

  approveTransfer = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const adminUserId = (req as any).user?.userId;
      if (!adminUserId) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }
      const result = await inventoryTransferService.approveTransfer(
        req.params.id,
        adminUserId
      );
      sendSuccess(res, 'Inventory transfer approved successfully.', result);
    } catch (error) {
      next(error);
    }
  };

  completeTransfer = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const adminUserId = (req as any).user?.userId;
      if (!adminUserId) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }
      const result = await inventoryTransferService.completeTransfer(
        req.params.id,
        adminUserId
      );
      sendSuccess(res, 'Inventory transfer completed successfully.', result);
    } catch (error) {
      next(error);
    }
  };

  cancelTransfer = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const adminUserId = (req as any).user?.userId;
      if (!adminUserId) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }
      const result = await inventoryTransferService.cancelTransfer(
        req.params.id,
        adminUserId
      );
      sendSuccess(res, 'Inventory transfer cancelled successfully.', result);
    } catch (error) {
      next(error);
    }
  };

  listTransfers = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const status = req.query.status as string | undefined;
      const result = await inventoryTransferService.listTransfers(page, limit, {
        status: status as any,
      });
      sendSuccess(res, 'Inventory transfers retrieved successfully.', result);
    } catch (error) {
      next(error);
    }
  };
}

export const inventoryTransferController = new InventoryTransferController();
