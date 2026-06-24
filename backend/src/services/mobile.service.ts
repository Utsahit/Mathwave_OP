import { prisma } from '../config/prisma';
import { getRedisClient } from '../config/redis';

const MOBILE_DASHBOARD_TTL = 100;

export class MobileService {
  async getDashboard(userId: string) {
    const cacheKey = `mobile:dashboard:${userId}`;

    try {
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      // proceed
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [upcomingReservations, recentOrders, favoriteCount] = await Promise.all([
      prisma.reservation.findMany({
        where: {
          customerId: userId,
          date: { gte: today },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        select: {
          id: true,
          reservationCode: true,
          date: true,
          timeSlot: true,
          guests: true,
          status: true,
        },
        take: 5,
        orderBy: { date: 'asc' },
      }),
      prisma.order.findMany({
        where: { userId },
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
          createdAt: true,
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.favoriteMenuItem.count({ where: { userId } }),
    ]);

    const data = { upcomingReservations, recentOrders, favoriteCount };

    try {
      const redis = getRedisClient();
      await redis.set(cacheKey, JSON.stringify(data), 'EX', MOBILE_DASHBOARD_TTL);
    } catch {
      // silent
    }

    return data;
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        loyaltyPoints: true,
        createdAt: true,
      },
    });
    return user;
  }

  async getOrders(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              menuItem: { select: { name: true } },
            },
          },
        },
      }),
      prisma.order.count({ where: { userId } }),
    ]);
    return { data: items, total, page, limit };
  }

  async getReservations(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.reservation.findMany({
        where: { customerId: userId },
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        select: {
          id: true,
          reservationCode: true,
          date: true,
          timeSlot: true,
          guests: true,
          status: true,
          table: { select: { number: true } },
        },
      }),
      prisma.reservation.count({ where: { customerId: userId } }),
    ]);
    return { data: items, total, page, limit };
  }
}

export const mobileService = new MobileService();
