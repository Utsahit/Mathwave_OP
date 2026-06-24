import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

const CART_SELECT = {
  id: true,
  userId: true,
  sessionId: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      menuItemId: true,
      quantity: true,
      menuItem: {
        select: {
          id: true,
          name: true,
          price: true,
          image: true,
        },
      },
    },
  },
} satisfies Prisma.CartSelect;

export class CartRepository {
  async createCart(data: { userId?: string; sessionId?: string; expiresAt?: Date }) {
    return prisma.cart.create({
      data,
      select: CART_SELECT,
    });
  }

  async findCartById(id: string) {
    return prisma.cart.findUnique({
      where: { id },
      select: CART_SELECT,
    });
  }

  async findCartByUserId(userId: string) {
    return prisma.cart.findUnique({
      where: { userId },
      select: CART_SELECT,
    });
  }

  async findCartBySessionId(sessionId: string) {
    return prisma.cart.findUnique({
      where: { sessionId },
      select: CART_SELECT,
    });
  }

  async addCartItem(cartId: string, menuItemId: string, quantity: number) {
    return prisma.cartItem.upsert({
      where: {
        cartId_menuItemId: { cartId, menuItemId },
      },
      update: {
        quantity: { increment: quantity },
      },
      create: {
        cartId,
        menuItemId,
        quantity,
      },
      select: {
        id: true,
        cartId: true,
        menuItemId: true,
        quantity: true,
      },
    });
  }

  async updateCartItem(cartItemId: string, quantity: number) {
    return prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
      select: {
        id: true,
        cartId: true,
        menuItemId: true,
        quantity: true,
      },
    });
  }

  async removeCartItem(cartItemId: string) {
    return prisma.cartItem.delete({
      where: { id: cartItemId },
      select: { id: true, cartId: true },
    });
  }

  async clearCart(cartId: string) {
    return prisma.cartItem.deleteMany({
      where: { cartId },
    });
  }

  async deleteCart(cartId: string) {
    return prisma.cart.delete({
      where: { id: cartId },
    });
  }

  async updateCartUser(cartId: string, userId: string) {
    return prisma.cart.update({
      where: { id: cartId },
      data: {
        userId,
        sessionId: null,
        expiresAt: null,
      },
      select: CART_SELECT,
    });
  }
}

export const cartRepository = new CartRepository();
