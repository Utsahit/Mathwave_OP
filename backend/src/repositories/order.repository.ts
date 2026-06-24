import { prisma } from '../config/prisma';
import { Prisma, OrderStatus } from '@prisma/client';
import { stockService } from '../services/stock.service';

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  userId: true,
  reservationId: true,
  totalAmount: true,
  subtotalAmount: true,
  taxAmount: true,
  couponDiscount: true,
  loyaltyDiscount: true,
  giftCardDiscount: true,
  finalAmount: true,
  status: true,
  couponId: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  createdAt: true,
  updatedAt: true,
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
          price: true,
        },
      },
    },
  },
  transactions: {
    select: {
      id: true,
      razorpayOrderId: true,
      razorpayPaymentId: true,
      amount: true,
      status: true,
      createdAt: true,
      verifiedAt: true,
    },
  },
  statusHistory: {
    select: {
      id: true,
      oldStatus: true,
      newStatus: true,
      changedBy: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
} satisfies Prisma.OrderSelect;

export class OrderRepository {
  async createOrder(data: {
    orderNumber: string;
    userId?: string | null;
    reservationId?: string | null;
    totalAmount: Prisma.Decimal | number;
    subtotalAmount: Prisma.Decimal | number;
    taxAmount: Prisma.Decimal | number;
    couponDiscount?: Prisma.Decimal | number;
    loyaltyDiscount?: Prisma.Decimal | number;
    giftCardDiscount?: Prisma.Decimal | number;
    finalAmount: Prisma.Decimal | number;
    couponId?: string | null;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    items: {
      menuItemId: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }[];
  }) {
    return prisma.order.create({
      data: {
        orderNumber: data.orderNumber,
        userId: data.userId,
        reservationId: data.reservationId,
        totalAmount: data.totalAmount,
        subtotalAmount: data.subtotalAmount,
        taxAmount: data.taxAmount,
        couponDiscount: data.couponDiscount ?? 0,
        loyaltyDiscount: data.loyaltyDiscount ?? 0,
        giftCardDiscount: data.giftCardDiscount ?? 0,
        finalAmount: data.finalAmount,
        couponId: data.couponId,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        items: {
          create: data.items.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        },
        statusHistory: {
          create: {
            oldStatus: OrderStatus.PENDING,
            newStatus: OrderStatus.PENDING,
            changedBy: 'system',
          },
        },
      },
      select: ORDER_SELECT,
    });
  }

  async findOrderById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      select: ORDER_SELECT,
    });
  }

  async findOrderByNumber(orderNumber: string) {
    return prisma.order.findUnique({
      where: { orderNumber },
      select: ORDER_SELECT,
    });
  }

  async listOrders(filters: {
    status?: OrderStatus;
    search?: string;
    page: number;
    limit: number;
    branchIds?: string[];
  }) {
    const where: Prisma.OrderWhereInput = {};

    if (filters.branchIds) {
      where.branchId = { in: filters.branchIds };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { orderNumber: { contains: filters.search, mode: 'insensitive' } },
        { customerEmail: { contains: filters.search, mode: 'insensitive' } },
        { customerName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: ORDER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
      }),
      prisma.order.count({ where }),
    ]);

    return { items, total };
  }

  async listUserOrders(userId: string, filters: { page: number; limit: number }) {
    const where: Prisma.OrderWhereInput = { userId };
    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: ORDER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
      }),
      prisma.order.count({ where }),
    ]);

    return { items, total };
  }

  async updateOrderStatus(
    id: string,
    oldStatus: OrderStatus,
    newStatus: OrderStatus,
    changedBy?: string
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Log Status History
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          oldStatus,
          newStatus,
          changedBy: changedBy || 'system',
        },
      });

      // 2. Update Order
      const updated = await tx.order.update({
        where: { id },
        data: { status: newStatus },
        select: ORDER_SELECT,
      });

      if (newStatus === OrderStatus.CONFIRMED) {
        await stockService.consumeStockForOrder(id, tx);
      }

      return updated;
    });
  }

  async getOrderStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalOrders, pendingOrders, ordersToday, totalRevenueAgg] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      prisma.order.count({
        where: {
          createdAt: { gte: todayStart },
        },
      }),
      prisma.order.aggregate({
        where: {
          status: {
            in: [
              OrderStatus.CONFIRMED,
              OrderStatus.PREPARING,
              OrderStatus.READY,
              OrderStatus.OUT_FOR_DELIVERY,
              OrderStatus.DELIVERED,
            ],
          },
        },
        _sum: {
          finalAmount: true,
        },
      }),
    ]);

    return {
      totalOrders,
      pendingOrders,
      ordersToday,
      totalRevenue: totalRevenueAgg._sum.finalAmount || 0,
    };
  }
}

export const orderRepository = new OrderRepository();
