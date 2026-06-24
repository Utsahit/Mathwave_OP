import { OrderStatus } from '@prisma/client';
import { orderService } from './order.service';
import { kitchenService } from './kitchen.service';
import { realtimeService } from './realtime.service';
import { getRedisClient } from '../config/redis';
import logger from '../config/logger';

export class FulfillmentService {
  async confirmOrder(orderId: string, changedBy: string) {
    const order = await orderService.updateOrderStatus(
      orderId,
      OrderStatus.CONFIRMED,
      changedBy
    );

    const ticket = await kitchenService.createTicket(orderId);

    try {
      realtimeService.broadcastToOrder(orderId, 'ORDER_CONFIRMED', { order, ticket });
    } catch (err) {
      logger.warn(
        { err },
        'Socket.IO emit ORDER_CONFIRMED failed — order processing continues'
      );
    }

    try {
      const redis = getRedisClient();
      await Promise.all([
        redis.del('order:stats'),
        redis.del('analytics:dashboard'),
        redis.del('analytics:orders'),
      ]);
    } catch {
      // silent
    }

    return order;
  }

  async startPreparing(orderId: string, ticketId: string, changedBy: string) {
    const order = await orderService.updateOrderStatus(
      orderId,
      OrderStatus.PREPARING,
      changedBy
    );
    const ticket = await kitchenService.startPreparation(ticketId);

    try {
      realtimeService.broadcastToKitchen('TICKET_STARTED', ticket);
      realtimeService.broadcastToOrder(orderId, 'ORDER_PREPARING', { order, ticket });
    } catch (err) {
      logger.warn(
        { err },
        'Socket.IO emit ORDER_PREPARING failed — order processing continues'
      );
    }

    return { order, ticket };
  }

  async markReady(orderId: string, ticketId: string, changedBy: string) {
    const ticket = await kitchenService.completePreparation(ticketId);
    const order = await orderService.updateOrderStatus(
      orderId,
      OrderStatus.READY,
      changedBy
    );

    try {
      realtimeService.broadcastToKitchen('TICKET_COMPLETED', ticket);
      realtimeService.broadcastToOrder(orderId, 'ORDER_READY', { order, ticket });
    } catch (err) {
      logger.warn(
        { err },
        'Socket.IO emit ORDER_READY failed — order processing continues'
      );
    }

    try {
      const redis = getRedisClient();
      await redis.del('analytics:dashboard');
    } catch {
      // silent
    }

    return { order, ticket };
  }

  async markOutForDelivery(orderId: string, changedBy: string) {
    const order = await orderService.updateOrderStatus(
      orderId,
      OrderStatus.OUT_FOR_DELIVERY,
      changedBy
    );

    try {
      realtimeService.broadcastToOrder(orderId, 'ORDER_OUT_FOR_DELIVERY', order);
    } catch (err) {
      logger.warn(
        { err },
        'Socket.IO emit ORDER_OUT_FOR_DELIVERY failed — order processing continues'
      );
    }

    return order;
  }

  async markDelivered(orderId: string, changedBy: string) {
    const order = await orderService.updateOrderStatus(
      orderId,
      OrderStatus.DELIVERED,
      changedBy
    );

    try {
      realtimeService.broadcastToOrder(orderId, 'ORDER_DELIVERED', order);
    } catch (err) {
      logger.warn(
        { err },
        'Socket.IO emit ORDER_DELIVERED failed — order processing continues'
      );
    }

    try {
      const redis = getRedisClient();
      await Promise.all([
        redis.del('analytics:dashboard'),
        redis.del('analytics:orders'),
        redis.del('analytics:revenue'),
      ]);
    } catch {
      // silent
    }

    return order;
  }

  async cancelOrder(orderId: string, changedBy: string) {
    const order = await orderService.updateOrderStatus(
      orderId,
      OrderStatus.CANCELLED,
      changedBy
    );

    try {
      realtimeService.broadcastToOrder(orderId, 'ORDER_CANCELLED', order);
    } catch (err) {
      logger.warn(
        { err },
        'Socket.IO emit ORDER_CANCELLED failed — order processing continues'
      );
    }

    try {
      const redis = getRedisClient();
      await Promise.all([
        redis.del('order:stats'),
        redis.del('analytics:dashboard'),
        redis.del('analytics:orders'),
      ]);
    } catch {
      // silent
    }

    return order;
  }
}

export const fulfillmentService = new FulfillmentService();
