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
    /* silent */
  }
}

interface BranchRanking {
  rank: number;
  branch: string;
  branchId: string;
  revenue: number;
  orders: number;
  reservations: number;
  customerGrowth: number;
  loyaltyAdoption: number;
  score: number;
}

export class BranchRankingService {
  async getRankings(): Promise<BranchRanking[]> {
    const cacheKey = 'analytics:branches:ranking';
    const cached = await getCached<BranchRanking[]>(cacheKey);
    if (cached) return cached;

    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const paidStatuses: OrderStatus[] = [
      'CONFIRMED',
      'PREPARING',
      'READY',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ];

    const rankings: BranchRanking[] = await Promise.all(
      branches.map(async (branch) => {
        const [revenueAgg, ordersCount, reservationsCount, customersCount, loyaltyCount] =
          await Promise.all([
            prisma.order.aggregate({
              where: {
                branchId: branch.id,
                createdAt: { gte: monthStart },
                status: { in: paidStatuses },
              },
              _sum: { finalAmount: true },
            }),
            prisma.order.count({
              where: { branchId: branch.id, createdAt: { gte: monthStart } },
            }),
            prisma.reservation.count({
              where: {
                branchId: branch.id,
                date: { gte: monthStart },
                status: { in: ['CONFIRMED', 'SEATED', 'COMPLETED'] },
              },
            }),
            prisma.order
              .groupBy({
                by: ['userId'],
                where: { branchId: branch.id, createdAt: { gte: monthStart } },
                _count: { id: true },
              })
              .then((r) => r.length),
            prisma.user.count({
              where: {
                loyaltyPoints: { gt: 0 },
                orders: { some: { branchId: branch.id } },
              },
            }),
          ]);

        const revenue = Number(revenueAgg._sum.finalAmount || 0);
        const orders = ordersCount;
        const reservations = reservationsCount;
        const customerGrowth = customersCount;
        const loyaltyAdoption = loyaltyCount;

        // Composite score (equal weight)
        const maxVal = Math.max(revenue, 1);
        const score = Math.round(
          (revenue / maxVal) * 25 +
            (orders / Math.max(orders, 1)) * 25 +
            (reservations / Math.max(reservations, 1)) * 20 +
            (customerGrowth / Math.max(customerGrowth, 1)) * 15 +
            (loyaltyAdoption / Math.max(loyaltyAdoption, 1)) * 15
        );

        return {
          rank: 0,
          branch: branch.name,
          branchId: branch.id,
          revenue,
          orders,
          reservations,
          customerGrowth,
          loyaltyAdoption,
          score,
        };
      })
    );

    rankings.sort((a, b) => b.score - a.score);
    rankings.forEach((r, i) => {
      r.rank = i + 1;
    });

    await setCache(cacheKey, rankings);
    return rankings;
  }
}

export const branchRankingService = new BranchRankingService();
