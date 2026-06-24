import { Request, Response, NextFunction } from 'express';
import { ingredientService } from '../services/ingredient.service';
import { sendSuccess } from '../utils/response';

export class IngredientController {
  createIngredient = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const ingredient = await ingredientService.createIngredient(req.body);
      res.status(201).json({
        success: true,
        message: 'Ingredient created successfully.',
        data: ingredient,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  };

  getIngredient = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const ingredient = await ingredientService.getIngredient(req.params.id);
      sendSuccess(res, 'Ingredient retrieved successfully.', ingredient);
    } catch (err) {
      next(err);
    }
  };

  updateIngredient = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const ingredient = await ingredientService.updateIngredient(
        req.params.id,
        req.body
      );
      sendSuccess(res, 'Ingredient updated successfully.', ingredient);
    } catch (err) {
      next(err);
    }
  };

  deleteIngredient = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await ingredientService.deleteIngredient(req.params.id);
      sendSuccess(res, 'Ingredient deleted successfully.', null);
    } catch (err) {
      next(err);
    }
  };

  listIngredients = async (
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

      const result = await ingredientService.listIngredients({
        isActive,
        search,
        page,
        limit,
      });
      sendSuccess(res, 'Ingredients retrieved successfully.', result.items, {
        page,
        limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const ingredientController = new IngredientController();
