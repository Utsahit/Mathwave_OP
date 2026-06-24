import { cartRepository } from '../repositories/cart.repository';
import { AppError } from '../utils/app-error';

const GUEST_CART_EXPIRATION_DAYS = 30;

export class CartService {
  async getOrCreateCart(filters: { userId?: string; sessionId?: string }) {
    if (!filters.userId && !filters.sessionId) {
      throw new AppError(
        'Either userId or sessionId is required to fetch a cart.',
        400,
        'BAD_REQUEST'
      );
    }

    if (filters.userId) {
      let cart = await cartRepository.findCartByUserId(filters.userId);
      if (!cart) {
        cart = await cartRepository.createCart({ userId: filters.userId });
      }
      return cart;
    } else if (filters.sessionId) {
      let cart = await cartRepository.findCartBySessionId(filters.sessionId);
      if (cart) {
        // Expiration check
        if (cart.expiresAt && cart.expiresAt < new Date()) {
          // Expired: Clear and delete cart
          await cartRepository.clearCart(cart.id);
          await cartRepository.deleteCart(cart.id);
          cart = null;
        }
      }

      if (!cart) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + GUEST_CART_EXPIRATION_DAYS);
        cart = await cartRepository.createCart({
          sessionId: filters.sessionId,
          expiresAt,
        });
      }
      return cart;
    }

    throw new AppError('Unable to resolve cart.', 400, 'BAD_REQUEST');
  }

  async addCartItem(
    filters: { userId?: string; sessionId?: string },
    menuItemId: string,
    quantity: number
  ) {
    const cart = await this.getOrCreateCart(filters);
    await cartRepository.addCartItem(cart.id, menuItemId, quantity);
    return this.getOrCreateCart(filters);
  }

  async updateCartItem(
    filters: { userId?: string; sessionId?: string },
    cartItemId: string,
    quantity: number
  ) {
    const cart = await this.getOrCreateCart(filters);
    // Ensure item belongs to cart
    const belongs = cart.items.some((i) => i.id === cartItemId);
    if (!belongs) {
      throw new AppError('Cart item does not belong to this cart.', 404, 'NOT_FOUND');
    }

    await cartRepository.updateCartItem(cartItemId, quantity);
    return this.getOrCreateCart(filters);
  }

  async removeCartItem(
    filters: { userId?: string; sessionId?: string },
    cartItemId: string
  ) {
    const cart = await this.getOrCreateCart(filters);
    const belongs = cart.items.some((i) => i.id === cartItemId);
    if (!belongs) {
      throw new AppError('Cart item does not belong to this cart.', 404, 'NOT_FOUND');
    }

    await cartRepository.removeCartItem(cartItemId);
    return this.getOrCreateCart(filters);
  }

  async mergeCartAfterLogin(sessionId: string, userId: string) {
    const guestCart = await cartRepository.findCartBySessionId(sessionId);
    if (!guestCart || guestCart.items.length === 0) {
      return this.getOrCreateCart({ userId });
    }

    const userCart = await this.getOrCreateCart({ userId });

    // Add items from guest cart to user cart
    for (const item of guestCart.items) {
      await cartRepository.addCartItem(userCart.id, item.menuItemId, item.quantity);
    }

    // Clean up guest cart
    await cartRepository.clearCart(guestCart.id);
    await cartRepository.deleteCart(guestCart.id);

    return this.getOrCreateCart({ userId });
  }

  calculateCartTotals(cart: {
    items: { quantity: number; menuItem: { price: unknown } }[];
  }) {
    let subtotal = 0;
    for (const item of cart.items) {
      const price = Number(item.menuItem.price);
      subtotal += price * item.quantity;
    }
    const taxRate = 0.05; // 5% GST
    const tax = subtotal * taxRate;
    const finalTotal = subtotal + tax;

    return {
      subtotal: Number(subtotal.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      finalTotal: Number(finalTotal.toFixed(2)),
    };
  }
}

export const cartService = new CartService();
