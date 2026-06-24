import { Request, Response, NextFunction } from 'express';
import { stockService } from '../services/stock.service';
import { sendSuccess } from '../utils/response';

export class InventoryController {
  makeManualAdjustment = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { quantity, comment } = req.body;
      const result = await stockService.makeManualAdjustment(
        req.params.ingredientId,
        quantity,
        comment
      );
      sendSuccess(res, 'Stock adjusted successfully.', result);
    } catch (err) {
      next(err);
    }
  };

  getLowStock = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await stockService.getLowStockIngredients({ page, limit });
      sendSuccess(res, 'Low stock ingredients retrieved successfully.', result.items, {
        page,
        limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  };

  getStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await stockService.getInventoryStats();
      sendSuccess(res, 'Inventory statistics retrieved successfully.', stats);
    } catch (err) {
      next(err);
    }
  };

  listStockMovements = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const ingredientId = req.query.ingredientId as string | undefined;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await stockService.listStockMovements({ ingredientId, page, limit });
      sendSuccess(res, 'Stock movements retrieved successfully.', result.items, {
        page,
        limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const inventoryController = new InventoryController();
