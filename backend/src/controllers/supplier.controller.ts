import { Request, Response, NextFunction } from 'express';
import { supplierService } from '../services/supplier.service';
import { sendSuccess } from '../utils/response';

export class SupplierController {
  createSupplier = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const supplier = await supplierService.createSupplier(req.body);
      res.status(201).json({
        success: true,
        message: 'Supplier created successfully.',
        data: supplier,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  };

  getSupplier = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const supplier = await supplierService.getSupplier(req.params.id);
      sendSuccess(res, 'Supplier retrieved successfully.', supplier);
    } catch (err) {
      next(err);
    }
  };

  updateSupplier = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const supplier = await supplierService.updateSupplier(req.params.id, req.body);
      sendSuccess(res, 'Supplier updated successfully.', supplier);
    } catch (err) {
      next(err);
    }
  };

  deleteSupplier = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await supplierService.deleteSupplier(req.params.id);
      sendSuccess(res, 'Supplier deleted successfully.', null);
    } catch (err) {
      next(err);
    }
  };

  listSuppliers = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const isActive =
        req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
      const search = req.query.search as string | undefined;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await supplierService.listSuppliers({
        isActive,
        search,
        page,
        limit,
      });
      sendSuccess(res, 'Suppliers retrieved successfully.', result.items, {
        page,
        limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  };

  addOrUpdateIngredient = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { ingredientId, pricePerUnit } = req.body;
      const mapping = await supplierService.addOrUpdateIngredient(
        req.params.id,
        ingredientId,
        pricePerUnit
      );
      sendSuccess(res, 'Supplier ingredient mapping saved successfully.', mapping);
    } catch (err) {
      next(err);
    }
  };

  removeIngredient = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await supplierService.removeIngredient(req.params.id, req.params.ingredientId);
      sendSuccess(res, 'Supplier ingredient mapping removed successfully.', null);
    } catch (err) {
      next(err);
    }
  };

  listSupplierIngredients = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const list = await supplierService.listSupplierIngredients(req.params.id);
      sendSuccess(res, 'Supplier ingredients retrieved successfully.', list);
    } catch (err) {
      next(err);
    }
  };
}

export const supplierController = new SupplierController();
