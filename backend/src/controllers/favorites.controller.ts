import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { favoritesService } from '../services/favorites.service';
import { sendSuccess } from '../utils/response';

export class FavoritesController {
  addFavorite = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { menuItemId } = req.params;
      const favorite = await favoritesService.addFavorite(req.user!.userId, menuItemId);
      sendSuccess(res, 'Item added to favorites.', favorite, {}, 201);
    } catch (err) {
      next(err);
    }
  };

  removeFavorite = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { menuItemId } = req.params;
      await favoritesService.removeFavorite(req.user!.userId, menuItemId);
      sendSuccess(res, 'Item removed from favorites.');
    } catch (err) {
      next(err);
    }
  };

  listFavorites = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await favoritesService.listFavorites(req.user!.userId, page, limit);
      sendSuccess(res, 'Favorites retrieved successfully.', result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const favoritesController = new FavoritesController();
