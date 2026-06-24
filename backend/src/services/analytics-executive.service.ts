import { prisma } from '../config/prisma';
import { getRedisClient } from '../config/redis';
import { OrderStatus } from '@prisma/client';

const STATS_TTL = 300;

async function getCached<T>(key: string): Promise<T | null> {
  try {
    const val = await getRedisClient().get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
}

async function setCache(key: string, data: unknown): Promise<void> {
  try {
    await getRedisClient().set(key, JSON.stringify(data), 'EX', STATS_TTL);
  } catch {
    // silent
  }
}

export class AnalyticsExecutiveService {
  async getRevenueDashboard() {
    const cacheKey = 'analytics:executive:revenue';
    const cached = await getCached<{
      todayRevenue: number;
      weekRevenue: number;
      monthRevenue: number;
      growthPercentage: number;
    }>(cacheKey);
    if (cached) return cached;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const lastMonthStart = new Date();
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    lastMonthStart.setDate(1);
    lastMonthStart.setHours(0, 0, 0, 0);

    const paidStatuses: OrderStatus[] = [
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.READY,
      OrderStatus.OUT_FOR_DELIVERY,
      OrderStatus.DELIVERED,
    ];

    const [todayAgg, weekAgg, monthAgg, lastMonthAgg] = await Promise.all([
      prisma.order.aggregate({
        where: { createdAt: { gte: todayStart }, status: { in: paidStatuses } },
        _sum: { finalAmount: true },
      }),
      prisma.order.aggregate({
        where: { createdAt: { gte: weekStart }, status: { in: paidStatuses } },
        _sum: { finalAmount: true },
      }),
      prisma.order.aggregate({
        where: { createdAt: { gte: monthStart }, status: { in: paidStatuses } },
        _sum: { finalAmount: true },
      }),
      prisma.order.aggregate({
        where: {
          createdAt: { gte: lastMonthStart, lt: monthStart },
          status: { in: paidStatuses },
        },
        _sum: { finalAmount: true },
      }),
    ]);

    const todayRevenue = Number(todayAgg._sum.finalAmount || 0);
    const weekRevenue = Number(weekAgg._sum.finalAmount || 0);
    const monthRevenue = Number(monthAgg._sum.finalAmount || 0);
    const lastMonthRevenue = Number(lastMonthAgg._sum.finalAmount || 0);
    const growthPercentage =
      lastMonthRevenue > 0
        ? ((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : 0;

    const result = {
      todayRevenue,
      weekRevenue,
      monthRevenue,
      growthPercentage: Math.round(growthPercentage * 100) / 100,
    };
    await setCache(cacheKey, result);
    return result;
  }

  async getOrderDashboard() {
    const cacheKey = 'analytics:executive:orders';
    const cached = await getCached<{
      todayOrders: number;
      weekOrders: number;
      monthOrders: number;
      avgOrderValue: number;
    }>(cacheKey);
    if (cached) return cached;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [todayOrders, weekOrders, monthOrders, avgAgg] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.order.aggregate({
        where: { createdAt: { gte: monthStart } },
        _avg: { finalAmount: true },
      }),
    ]);

    const result = {
      todayOrders,
      weekOrders,
      monthOrders,
      avgOrderValue: Number(avgAgg._avg.finalAmount || 0),
    };
    await setCache(cacheKey, result);
    return result;
  }

  async getReservationDashboard() {
    const cacheKey = 'analytics:executive:reservations';
    const cached = await getCached<{
      todayReservations: number;
      weekReservations: number;
      utilizationRate: number;
    }>(cacheKey);
    if (cached) return cached;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const [todayReservations, weekReservations, totalTables] = await Promise.all([
      prisma.reservation.count({
        where: {
          date: { gte: todayStart },
          status: { in: ['CONFIRMED', 'SEATED', 'COMPLETED'] },
        },
      }),
      prisma.reservation.count({
        where: {
          date: { gte: weekStart },
          status: { in: ['CONFIRMED', 'SEATED', 'COMPLETED'] },
        },
      }),
      prisma.table.count({ where: { isActive: true } }),
    ]);

    const utilizationRate = totalTables > 0 ? (todayReservations / totalTables) * 100 : 0;

    const result = {
      todayReservations,
      weekReservations,
      utilizationRate: Math.round(utilizationRate * 100) / 100,
    };
    await setCache(cacheKey, result);
    return result;
  }

  async getCustomerDashboard() {
    const cacheKey = 'analytics:executive:customers';
    const cached = await getCached<{
      totalCustomers: number;
      repeatCustomers: number;
      newCustomers: number;
    }>(cacheKey);
    if (cached) return cached;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [totalCustomers, repeatCustomers, newCustomers] = await Promise.all([
      prisma.user.count({ where: { isDeleted: false } }),
      prisma.order
        .groupBy({
          by: ['userId'],
          _count: { id: true },
          having: { id: { _count: { gt: 1 } } },
        })
        .then((r) => r.length),
      prisma.user.count({ where: { createdAt: { gte: monthStart }, isDeleted: false } }),
    ]);

    const result = { totalCustomers, repeatCustomers, newCustomers };
    await setCache(cacheKey, result);
    return result;
  }

  // Combined executive dashboard (aggregated)
  async getExecutiveDashboard() {
    const [revenue, orders, reservations, customers] = await Promise.all([
      this.getRevenueDashboard(),
      this.getOrderDashboard(),
      this.getReservationDashboard(),
      this.getCustomerDashboard(),
    ]);
    return { revenue, orders, reservations, customers };
  }
}

export const analyticsExecutiveService = new AnalyticsExecutiveService();
