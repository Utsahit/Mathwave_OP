import { prisma } from '../config/prisma';
import { getRedisClient } from '../config/redis';
import { OrderStatus, ReservationStatus } from '@prisma/client';

const CACHE_TTL = 300;

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
    await getRedisClient().set(key, JSON.stringify(data), 'EX', CACHE_TTL);
  } catch {
    // silent
  }
}

export class BranchAnalyticsService {
  async getBranchSales(branchId: string, startDate?: string, endDate?: string) {
    const cacheKey = `branch:analytics:${branchId}`;
    const cached = await getCached<{
      totalRevenue: number;
      orderCount: number;
      avgOrderValue: number;
    }>(cacheKey);
    if (cached) {
      if (!startDate && !endDate) return cached;
    }

    const where: any = { branchId };

    if (startDate || endDate) {
      where.createdAt = {} as any;
      if (startDate) (where.createdAt as any).gte = new Date(startDate);
      if (endDate) (where.createdAt as any).lte = new Date(endDate);
    }

    const nonCancelled = [
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.READY,
      OrderStatus.OUT_FOR_DELIVERY,
      OrderStatus.DELIVERED,
    ];

    const [revenueAgg, countAgg] = await Promise.all([
      prisma.order.aggregate({
        where: { ...where, status: { in: nonCancelled } },
        _sum: { finalAmount: true },
      }),
      prisma.order.aggregate({
        where: { ...where, status: OrderStatus.DELIVERED },
        _count: { id: true },
        _avg: { finalAmount: true },
      }),
    ]);

    const totalRevenue = Number(revenueAgg._sum.finalAmount || 0);
    const orderCount = countAgg._count.id;
    const avgOrderValue = orderCount > 0 ? Number(countAgg._avg.finalAmount || 0) : 0;

    const result = { totalRevenue, orderCount, avgOrderValue };

    if (!startDate && !endDate) {
      await setCache(cacheKey, result);
    }

    return result;
  }

  async getBranchInventory(branchId: string) {
    const cacheKey = `branch:analytics:${branchId}`;
    const cached = await getCached<{
      stockValue: number;
      lowStockCount: number;
    }>(cacheKey);
    if (cached) return cached;

    const valueRes = await prisma.$queryRaw<{ total_value: number | null }[]>`
      SELECT SUM("currentStock" * "costPerUnit")::float as total_value
      FROM "Ingredient"
      WHERE "isDeleted" = false AND "isActive" = true
    `;
    const stockValue = valueRes[0]?.total_value || 0;

    const lowStockRes = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint as count
      FROM "Ingredient"
      WHERE "isDeleted" = false AND "isActive" = true AND "currentStock" <= "minimumStock"
    `;
    const lowStockCount = Number(lowStockRes[0]?.count || 0);

    const result = { stockValue, lowStockCount };
    await setCache(cacheKey, result);
    return result;
  }

  async getBranchReservations(branchId: string, startDate?: string, endDate?: string) {
    const resWhere: any = { branchId };
    if (startDate || endDate) {
      resWhere.date = {} as any;
      if (startDate) resWhere.date.gte = new Date(startDate);
      if (endDate) resWhere.date.lte = new Date(endDate);
    }

    const counts = await prisma.reservation.groupBy({
      by: ['status'],
      where: resWhere,
      _count: { id: true },
    });

    const statusMap: Record<string, number> = {};
    for (const c of counts) {
      statusMap[c.status] = c._count.id;
    }

    return {
      pending: statusMap[ReservationStatus.PENDING] || 0,
      confirmed: statusMap[ReservationStatus.CONFIRMED] || 0,
      seated: statusMap[ReservationStatus.SEATED] || 0,
      completed: statusMap[ReservationStatus.COMPLETED] || 0,
      cancelled: statusMap[ReservationStatus.CANCELLED] || 0,
      noShow: statusMap[ReservationStatus.NO_SHOW] || 0,
    };
  }

  async getBranchLoyalty(branchId: string) {
    const cacheKey = `branch:analytics:${branchId}`;
    const cached = await getCached<{
      pointsEarned: number;
      pointsRedeemed: number;
    }>(cacheKey);
    if (cached) return cached;

    const branchOrderIds = await prisma.order.findMany({
      where: { branchId },
      select: { id: true },
    });
    const orderIdSet = new Set(branchOrderIds.map((o) => o.id));

    if (orderIdSet.size === 0) {
      const result = { pointsEarned: 0, pointsRedeemed: 0 };
      await setCache(cacheKey, result);
      return result;
    }

    const orderIds = [...orderIdSet];

    const [earnedAgg, redeemedAgg] = await Promise.all([
      prisma.loyaltyTransaction.aggregate({
        where: {
          type: 'EARN' as any,
          orderId: { in: orderIds },
        },
        _sum: { points: true },
      }),
      prisma.loyaltyTransaction.aggregate({
        where: {
          type: 'REDEEM' as any,
          orderId: { in: orderIds },
        },
        _sum: { points: true },
      }),
    ]);

    const result = {
      pointsEarned: earnedAgg._sum.points || 0,
      pointsRedeemed: Math.abs(redeemedAgg._sum.points || 0),
    };

    await setCache(cacheKey, result);
    return result;
  }

  async getBranchCustomers(branchId: string) {
    const cacheKey = `branch:analytics:${branchId}`;
    const cached = await getCached<{ uniqueCustomers: number }>(cacheKey);
    if (cached) return cached;

    const result = await prisma.order.aggregate({
      where: { branchId } as any,
      _count: { userId: true },
    });

    const data = { uniqueCustomers: result._count.userId };
    await setCache(cacheKey, data);
    return data;
  }

  async getAllBranchesOverview(branchIds?: string[] | null) {
    const branches =
      branchIds === null
        ? await prisma.branch.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          })
        : branchIds && branchIds.length > 0
          ? await prisma.branch.findMany({
              where: { id: { in: branchIds }, isActive: true },
              select: { id: true, name: true },
              orderBy: { name: 'asc' },
            })
          : [];

    if (branches.length === 0) return [];

    const allBranchIds = branches.map((b) => b.id);

    const orders = await prisma.order.groupBy({
      by: ['branchId'],
      where: {
        branchId: { in: allBranchIds },
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
      _sum: { finalAmount: true },
      _count: { id: true },
    });

    const deliveredOrders = await prisma.order.groupBy({
      by: ['branchId'],
      where: {
        branchId: { in: allBranchIds },
        status: OrderStatus.DELIVERED,
      },
      _avg: { finalAmount: true },
    });

    const revenueMap = new Map(
      orders.map((o) => [o.branchId, Number(o._sum.finalAmount || 0)])
    );
    const orderCountMap = new Map(orders.map((o) => [o.branchId, o._count.id]));
    const avgMap = new Map(
      deliveredOrders.map((o) => [o.branchId, Number(o._avg.finalAmount || 0)])
    );

    const overview = branches.map((b) => ({
      branchId: b.id,
      name: b.name,
      revenue: revenueMap.get(b.id) || 0,
      orderCount: orderCountMap.get(b.id) || 0,
      avgOrderValue: avgMap.get(b.id) || 0,
    }));

    return overview;
  }
}

export const branchAnalyticsService = new BranchAnalyticsService();
