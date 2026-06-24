import { Request, Response, NextFunction } from 'express';
import { menuService } from '../services/menu.service';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/app-error';

export class MenuController {
  // ── Category Controllers ──

  createCategory = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const category = await menuService.createCategory(req.body);
      sendSuccess(res, 'Menu category created successfully.', category, {}, 201);
    } catch (err) {
      next(err);
    }
  };

  getCategory = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const category = await menuService.getCategory(req.params.id);
      sendSuccess(res, 'Menu category retrieved successfully.', category);
    } catch (err) {
      next(err);
    }
  };

  updateCategory = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const category = await menuService.updateCategory(req.params.id, req.body);
      sendSuccess(res, 'Menu category updated successfully.', category);
    } catch (err) {
      next(err);
    }
  };

  deleteCategory = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await menuService.deleteCategory(req.params.id);
      sendSuccess(res, 'Menu category soft-deleted successfully.');
    } catch (err) {
      next(err);
    }
  };

  listCategories = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const search = req.query.search as string;

      const { items, total } = await menuService.listCategories({ search, page, limit });
      sendSuccess(res, 'Menu categories listed successfully.', items, {
        page,
        limit,
        total,
      });
    } catch (err) {
      next(err);
    }
  };

  // ── MenuItem Controllers ──

  createMenuItem = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const item = await menuService.createMenuItem(req.body);
      sendSuccess(res, 'Menu item created successfully.', item, {}, 201);
    } catch (err) {
      next(err);
    }
  };

  getMenuItem = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const item = await menuService.getMenuItem(req.params.id);
      sendSuccess(res, 'Menu item retrieved successfully.', item);
    } catch (err) {
      next(err);
    }
  };

  updateMenuItem = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const item = await menuService.updateMenuItem(req.params.id, req.body);
      sendSuccess(res, 'Menu item updated successfully.', item);
    } catch (err) {
      next(err);
    }
  };

  deleteMenuItem = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await menuService.deleteMenuItem(req.params.id);
      sendSuccess(res, 'Menu item soft-deleted successfully.');
    } catch (err) {
      next(err);
    }
  };

  listMenuItems = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const search = req.query.search as string;
      const categoryId = req.query.categoryId as string;
      const featured =
        req.query.featured === 'true'
          ? true
          : req.query.featured === 'false'
            ? false
            : undefined;
      const active =
        req.query.active === 'true'
          ? true
          : req.query.active === 'false'
            ? false
            : undefined;
      const sortBy = (req.query.sortBy as 'name' | 'price' | 'createdAt') || 'createdAt';
      const order = (req.query.order as 'asc' | 'desc') || 'asc';

      const { items, total } = await menuService.listMenuItems({
        search,
        categoryId,
        featured,
        active,
        sortBy,
        order,
        page,
        limit,
      });

      sendSuccess(res, 'Menu items listed successfully.', items, {
        page,
        limit,
        total,
      });
    } catch (err) {
      next(err);
    }
  };

  // ── Public Access Controllers ──

  getPublicMenu = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await menuService.getPublicMenu();
      sendSuccess(res, 'Public menu retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  getPublicCategories = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await menuService.getPublicCategories();
      sendSuccess(res, 'Public menu categories retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  // ── Image Upload Controller ──

  uploadMenuItemImage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.file) {
        throw new AppError('No image file provided.', 400, 'FILE_MISSING');
      }

      // Format URL path for static file serving
      const imageUrl = `/uploads/${req.file.filename}`;

      // Update menu item in DB with new imageUrl
      const item = await menuService.updateMenuItem(req.params.id, { imageUrl });

      sendSuccess(res, 'Menu item image uploaded successfully.', item);
    } catch (err) {
      next(err);
    }
  };
}

export const menuController = new MenuController();
