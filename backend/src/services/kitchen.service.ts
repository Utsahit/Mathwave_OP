import { prisma } from '../config/prisma';
import { Prisma, TicketPriority } from '@prisma/client';
import { AppError } from '../utils/app-error';
import { realtimeService } from './realtime.service';
import logger from '../config/logger';

const TICKET_SELECT = {
  id: true,
  orderId: true,
  stationId: true,
  priority: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  station: {
    select: {
      id: true,
      name: true,
      isActive: true,
    },
  },
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      customerName: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          menuItemId: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          menuItem: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  },
} as const;

export class KitchenService {
  async findExistingTicket(orderId: string) {
    return prisma.kitchenTicket.findUnique({
      where: { orderId },
      select: TICKET_SELECT,
    });
  }

  async createTicket(orderId: string, priority: TicketPriority = TicketPriority.NORMAL) {
    const existing = await this.findExistingTicket(orderId);
    if (existing) {
      return existing;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });

    if (!order) {
      throw new AppError('Order not found.', 404, 'NOT_FOUND');
    }

    const ticket = await prisma.kitchenTicket.create({
      data: { orderId, priority },
      select: TICKET_SELECT,
    });

    try {
      realtimeService.broadcastToKitchen('TICKET_CREATED', ticket);
    } catch (err) {
      logger.warn(
        { err },
        'Socket.IO emit TICKET_CREATED failed — order processing continues'
      );
    }

    return ticket;
  }

  async assignStation(ticketId: string, stationId: string) {
    const station = await prisma.kitchenStation.findUnique({
      where: { id: stationId },
    });

    if (!station || !station.isActive) {
      throw new AppError('Station not found or inactive.', 404, 'NOT_FOUND');
    }

    const ticket = await prisma.kitchenTicket.update({
      where: { id: ticketId },
      data: { stationId },
      select: TICKET_SELECT,
    });

    try {
      realtimeService.broadcastToKitchen('TICKET_ASSIGNED', ticket);
    } catch (err) {
      logger.warn(
        { err },
        'Socket.IO emit TICKET_ASSIGNED failed — order processing continues'
      );
    }

    return ticket;
  }

  async startPreparation(ticketId: string) {
    const ticket = await prisma.kitchenTicket.update({
      where: { id: ticketId },
      data: { startedAt: new Date() },
      select: TICKET_SELECT,
    });

    try {
      realtimeService.broadcastToKitchen('TICKET_STARTED', ticket);
    } catch (err) {
      logger.warn(
        { err },
        'Socket.IO emit TICKET_STARTED failed — order processing continues'
      );
    }

    return ticket;
  }

  async completePreparation(ticketId: string) {
    const ticket = await prisma.kitchenTicket.update({
      where: { id: ticketId },
      data: { completedAt: new Date() },
      select: TICKET_SELECT,
    });

    try {
      realtimeService.broadcastToKitchen('TICKET_COMPLETED', ticket);
    } catch (err) {
      logger.warn(
        { err },
        'Socket.IO emit TICKET_COMPLETED failed — order processing continues'
      );
    }

    return ticket;
  }

  async updatePriority(ticketId: string, priority: TicketPriority) {
    const ticket = await prisma.kitchenTicket.update({
      where: { id: ticketId },
      data: { priority },
      select: TICKET_SELECT,
    });

    try {
      realtimeService.broadcastToKitchen('TICKET_PRIORITY_UPDATED', ticket);
    } catch (err) {
      logger.warn(
        { err },
        'Socket.IO emit TICKET_PRIORITY_UPDATED failed — order processing continues'
      );
    }

    return ticket;
  }

  async getTicket(id: string) {
    const ticket = await prisma.kitchenTicket.findUnique({
      where: { id },
      select: TICKET_SELECT,
    });

    if (!ticket) {
      throw new AppError('Kitchen ticket not found.', 404, 'NOT_FOUND');
    }

    return ticket;
  }

  async listTickets(filters: {
    stationId?: string;
    status?: 'active' | 'pending' | 'completed';
    priority?: TicketPriority;
    page: number;
    limit: number;
    branchIds?: string[];
  }) {
    const where: Prisma.KitchenTicketWhereInput = {};

    if (filters.branchIds) {
      where.branchId = { in: filters.branchIds };
    }

    if (filters.stationId) {
      where.stationId = filters.stationId;
    }

    if (filters.status === 'active') {
      where.startedAt = { not: null };
      where.completedAt = null;
    } else if (filters.status === 'pending') {
      where.startedAt = null;
    } else if (filters.status === 'completed') {
      where.completedAt = { not: null };
    }

    if (filters.priority) {
      where.priority = filters.priority;
    }

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      prisma.kitchenTicket.findMany({
        where,
        select: TICKET_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
      }),
      prisma.kitchenTicket.count({ where }),
    ]);

    return { items, total };
  }
}

export const kitchenService = new KitchenService();
