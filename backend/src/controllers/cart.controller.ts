import { Request, Response, NextFunction } from 'express';
import { cartService } from '../services/cart.service';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth';

export class CartController {
  private getFilters(req: Request) {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;
    const sessionId =
      (req.headers['x-session-id'] as string) || (req.query.sessionId as string);
    return { userId, sessionId };
  }

  getCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = this.getFilters(req);
      const cart = await cartService.getOrCreateCart(filters);
      const totals = cartService.calculateCartTotals(cart);
      sendSuccess(res, 'Cart retrieved successfully.', { ...cart, totals });
    } catch (err) {
      next(err);
    }
  };

  addCartItem = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const filters = this.getFilters(req);
      const { menuItemId, quantity } = req.body;
      const cart = await cartService.addCartItem(filters, menuItemId, quantity);
      const totals = cartService.calculateCartTotals(cart);
      sendSuccess(res, 'Item added to cart successfully.', { ...cart, totals });
    } catch (err) {
      next(err);
    }
  };

  updateCartItem = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const filters = this.getFilters(req);
      const { id } = req.params;
      const { quantity } = req.body;
      const cart = await cartService.updateCartItem(filters, id, quantity);
      const totals = cartService.calculateCartTotals(cart);
      sendSuccess(res, 'Cart item updated successfully.', { ...cart, totals });
    } catch (err) {
      next(err);
    }
  };

  removeCartItem = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const filters = this.getFilters(req);
      const { id } = req.params;
      const cart = await cartService.removeCartItem(filters, id);
      const totals = cartService.calculateCartTotals(cart);
      sendSuccess(res, 'Item removed from cart successfully.', { ...cart, totals });
    } catch (err) {
      next(err);
    }
  };

  mergeCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }
      const { sessionId } = req.body;
      if (!sessionId) {
        res
          .status(400)
          .json({ success: false, message: 'Session ID is required for merging.' });
        return;
      }
      const cart = await cartService.mergeCartAfterLogin(sessionId, userId);
      const totals = cartService.calculateCartTotals(cart);
      sendSuccess(res, 'Carts merged successfully.', { ...cart, totals });
    } catch (err) {
      next(err);
    }
  };
}

export const cartController = new CartController();
