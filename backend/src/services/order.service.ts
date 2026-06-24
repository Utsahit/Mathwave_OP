import { orderRepository } from '../repositories/order.repository';
import { cartRepository } from '../repositories/cart.repository';
import { cartService } from './cart.service';
import { couponService } from './coupon.service';
import { giftCardService } from './giftcard.service';
import { loyaltyService } from './loyalty.service';
import { getRedisClient } from '../config/redis';
import { AppError } from '../utils/app-error';
import { OrderStatus } from '@prisma/client';
import crypto from 'crypto';
import { notificationService } from './notification.service';
import { auditService } from './audit.service';

const STATS_TTL = 300; // 5 minutes

// Valid status transitions map
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

async function getRedisStats<T>(key: string): Promise<T | null> {
  try {
    const val = await getRedisClient().get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
}

async function setRedisStats(key: string, data: unknown): Promise<void> {
  try {
    await getRedisClient().set(key, JSON.stringify(data), 'EX', STATS_TTL);
  } catch {
    // Silent fail
  }
}

async function clearStatsCache() {
  try {
    await getRedisClient().del('order:stats');
  } catch {
    // Silent fail
  }
}

export class OrderService {
  async createOrderFromCart(
    cartId: string,
    customerDetails: {
      customerName: string;
      customerEmail: string;
      customerPhone: string;
      reservationId?: string;
    },
    userId?: string,
    discounts?: {
      couponCode?: string;
      giftCardCode?: string;
      loyaltyPoints?: number;
    }
  ) {
    const redis = getRedisClient();

    // 1. Distributed lock: lock:order:{cartId} to prevent double click (10s TTL)
    const lockKey = `lock:order:${cartId}`;
    try {
      const acquired = await redis.set(lockKey, 'locked', 'EX', 10, 'NX');
      if (!acquired) {
        throw new AppError(
          'An order submission is already in progress for this cart.',
          409,
          'LOCK_ACQUIRED_FAILED'
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
    }

    // Fetch cart
    const cart = await cartRepository.findCartById(cartId);
    if (!cart || cart.items.length === 0) {
      await redis.del(lockKey).catch(() => {});
      throw new AppError('Cannot place an order with an empty cart.', 400, 'EMPTY_CART');
    }

    // 2. Hash lock: prevent duplicate checkouts in 60s (content hash)
    const cartContents = cart.items
      .map((i) => `${i.menuItemId}:${i.quantity}`)
      .sort()
      .join(',');
    const cartHash = crypto
      .createHash('sha256')
      .update(`${cartId}:${customerDetails.customerEmail}:${cartContents}`)
      .digest('hex');

    const hashLockKey = `lock:order:hash:${cartHash}`;
    try {
      const hashExists = await redis.get(hashLockKey);
      if (hashExists) {
        await redis.del(lockKey).catch(() => {});
        throw new AppError(
          'A duplicate order was recently submitted. Please wait 60 seconds.',
          409,
          'DUPLICATE_ORDER'
        );
      }
      await redis.set(hashLockKey, 'locked', 'EX', 60);
    } catch (err) {
      if (err instanceof AppError) throw err;
    }

    try {
      // Calculate base totals
      const totals = cartService.calculateCartTotals(cart);
      const subtotal = Number(totals.subtotal);

      // Discount waterfall: Subtotal -> Coupon -> Loyalty -> Gift Card -> Tax -> Final
      let afterSubtotal = subtotal;
      let couponDiscountVal = 0;
      let couponId: string | null = null;
      let loyaltyDiscountVal = 0;
      let giftCardDiscountVal = 0;

      // Step 1: Apply Coupon
      if (discounts?.couponCode) {
        const coupon = await couponService.validateCoupon(
          discounts.couponCode,
          afterSubtotal
        );
        couponDiscountVal = couponService.calculateDiscount(coupon, afterSubtotal);
        couponId = coupon.id;
        afterSubtotal -= couponDiscountVal;
      }

      // Step 2: Apply Loyalty Points
      if (discounts?.loyaltyPoints && userId) {
        const discount = await loyaltyService.redeemPoints(
          userId,
          discounts.loyaltyPoints
        );
        loyaltyDiscountVal = Number(discount.discountValue);
        afterSubtotal -= loyaltyDiscountVal;
      }

      // Step 3: Apply Gift Card (validate first, redeem after order creation)
      if (discounts?.giftCardCode) {
        const giftCard = await giftCardService.validateGiftCard(discounts.giftCardCode);
        giftCardDiscountVal = Math.min(giftCard.remainingAmount, afterSubtotal);
        afterSubtotal -= giftCardDiscountVal;
      }

      // Ensure non-negative
      afterSubtotal = Math.max(0, afterSubtotal);

      // Calculate tax on discounted amount
      const taxRate = subtotal > 0 ? Number(totals.tax) / subtotal : 0;
      const taxAmount = Math.round(afterSubtotal * taxRate * 100) / 100;

      const finalAmount = Math.round((afterSubtotal + taxAmount) * 100) / 100;

      // Unique order number: EO-TIMESTAMP-RANDOM
      const orderNumber = `EO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Create Order with discount snapshots
      const order = await orderRepository.createOrder({
        orderNumber,
        userId: userId || cart.userId,
        reservationId: customerDetails.reservationId,
        totalAmount: subtotal,
        subtotalAmount: subtotal,
        taxAmount,
        couponDiscount: couponDiscountVal,
        loyaltyDiscount: loyaltyDiscountVal,
        giftCardDiscount: giftCardDiscountVal,
        finalAmount,
        couponId,
        customerName: customerDetails.customerName,
        customerEmail: customerDetails.customerEmail,
        customerPhone: customerDetails.customerPhone,
        items: cart.items.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: Number(item.menuItem.price),
          totalPrice: Number(item.menuItem.price) * item.quantity,
        })),
      });

      // Execute actual gift card redemption with order ID
      if (discounts?.giftCardCode && giftCardDiscountVal > 0) {
        await giftCardService
          .redeemGiftCard(discounts.giftCardCode, order.id, giftCardDiscountVal)
          .catch(() => {});
      }

      // Apply coupon (deduct usage + create redemption record)
      if (discounts?.couponCode && couponDiscountVal > 0 && couponId) {
        couponService
          .applyCoupon(discounts.couponCode, subtotal, order.userId || '', order.id)
          .catch(() => {});
      }

      // Earn loyalty points for the purchase
      if (order.userId) {
        loyaltyService.earnPoints(order.userId, finalAmount, order.id).catch(() => {});
      }

      // Clear the Cart
      await cartRepository.clearCart(cartId);

      // Invalidate cache (exact key)
      await clearStatsCache();

      if (order.userId) {
        notificationService
          .create(
            order.userId,
            null,
            'ORDER_CREATED',
            'Order Created',
            `Order #${order.orderNumber} has been placed successfully.`,
            'IN_APP',
            { orderId: order.id }
          )
          .catch(() => {});
      }
      auditService
        .logCreate(null, 'Order', order.id, {
          orderNumber: order.orderNumber,
          totalAmount: Number(order.subtotalAmount),
          finalAmount: Number(order.finalAmount),
          couponDiscount: Number(order.couponDiscount),
          loyaltyDiscount: Number(order.loyaltyDiscount),
          giftCardDiscount: Number(order.giftCardDiscount),
        })
        .catch(() => {});

      return order;
    } finally {
      // Clean up fast-locks
      await redis.del(lockKey).catch(() => {});
    }
  }

  async getOrder(id: string) {
    const order = await orderRepository.findOrderById(id);
    if (!order) {
      throw new AppError('Order not found.', 404, 'NOT_FOUND');
    }
    return order;
  }

  async getOrderByNumber(orderNumber: string) {
    const order = await orderRepository.findOrderByNumber(orderNumber);
    if (!order) {
      throw new AppError('Order not found.', 404, 'NOT_FOUND');
    }
    return order;
  }

  async listOrders(filters: {
    status?: OrderStatus;
    search?: string;
    page: number;
    limit: number;
    branchIds?: string[];
  }) {
    return orderRepository.listOrders(filters);
  }

  async listUserOrders(userId: string, filters: { page: number; limit: number }) {
    return orderRepository.listUserOrders(userId, filters);
  }

  async updateOrderStatus(id: string, newStatus: OrderStatus, changedBy?: string) {
    const order = await this.getOrder(id);

    // Status transition validation
    const allowed = VALID_TRANSITIONS[order.status];
    if (!allowed.includes(newStatus)) {
      throw new AppError(
        `Invalid status transition from ${order.status} to ${newStatus}.`,
        422,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const updated = await orderRepository.updateOrderStatus(
      id,
      order.status,
      newStatus,
      changedBy
    );
    await clearStatsCache();

    if (updated.userId) {
      const eventMap: Record<
        string,
        {
          type: 'ORDER_CONFIRMED' | 'ORDER_READY' | 'ORDER_DELIVERED';
          title: string;
          message: string;
        } | null
      > = {
        CONFIRMED: {
          type: 'ORDER_CONFIRMED',
          title: 'Order Confirmed',
          message: `Order #${updated.orderNumber} has been confirmed.`,
        },
        READY: {
          type: 'ORDER_READY',
          title: 'Order Ready',
          message: `Order #${updated.orderNumber} is ready.`,
        },
        DELIVERED: {
          type: 'ORDER_DELIVERED',
          title: 'Order Delivered',
          message: `Order #${updated.orderNumber} has been delivered.`,
        },
        CANCELLED: null,
        PREPARING: null,
        OUT_FOR_DELIVERY: null,
      };
      const event = eventMap[newStatus];
      if (event) {
        notificationService
          .create(
            updated.userId,
            null,
            event.type,
            event.title,
            event.message,
            'IN_APP',
            { orderId: updated.id }
          )
          .catch(() => {});
      }
    }
    auditService
      .logStatusChange(changedBy ?? null, 'Order', id, order.status, newStatus)
      .catch(() => {});

    return updated;
  }

  async getOrderStats() {
    const cacheKey = 'order:stats';
    const cached = await getRedisStats<{
      totalOrders: number;
      pendingOrders: number;
      ordersToday: number;
      totalRevenue: number;
    }>(cacheKey);

    if (cached) return cached;

    const stats = await orderRepository.getOrderStats();
    await setRedisStats(cacheKey, stats);
    return stats;
  }
}

export const orderService = new OrderService();
