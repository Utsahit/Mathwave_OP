import { prisma } from '../config/prisma';
import { getRedisClient } from '../config/redis';

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

export class ProductIntelligenceService {
  async getTopSellingItems(period: 'day' | 'week' | 'month' | 'year' = 'month') {
    const cacheKey = `analytics:products:top:${period}`;
    const cached =
      await getCached<
        { menuItemId: string; name: string; totalSold: number; revenue: number }[]
      >(cacheKey);
    if (cached) return cached;

    const since = new Date();
    if (period === 'day') since.setDate(since.getDate() - 1);
    else if (period === 'week') since.setDate(since.getDate() - 7);
    else if (period === 'month') since.setMonth(since.getMonth() - 1);
    else since.setFullYear(since.getFullYear() - 1);

    const items = await prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where: { order: { createdAt: { gte: since } } },
      _sum: { quantity: true, unitPrice: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 20,
    });

    const menuItemIds = items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, name: true },
    });
    const menuMap = new Map(menuItems.map((m) => [m.id, m.name]));

    const result = items.map((i) => ({
      menuItemId: i.menuItemId,
      name: menuMap.get(i.menuItemId) || 'Unknown',
      totalSold: i._sum.quantity || 0,
      revenue: Number(i._sum.unitPrice || 0),
    }));

    await setCache(cacheKey, result);
    return result;
  }

  async getWorstSellingItems(period: 'day' | 'week' | 'month' | 'year' = 'month') {
    const cacheKey = `analytics:products:worst:${period}`;
    const cached =
      await getCached<{ menuItemId: string; name: string; totalSold: number }[]>(
        cacheKey
      );
    if (cached) return cached;

    const since = new Date();
    if (period === 'day') since.setDate(since.getDate() - 1);
    else if (period === 'week') since.setDate(since.getDate() - 7);
    else if (period === 'month') since.setMonth(since.getMonth() - 1);
    else since.setFullYear(since.getFullYear() - 1);

    const items = await prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where: { order: { createdAt: { gte: since } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'asc' } },
      take: 20,
    });

    const menuItemIds = items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, name: true },
    });
    const menuMap = new Map(menuItems.map((m) => [m.id, m.name]));

    const result = items.map((i) => ({
      menuItemId: i.menuItemId,
      name: menuMap.get(i.menuItemId) || 'Unknown',
      totalSold: i._sum.quantity || 0,
    }));

    await setCache(cacheKey, result);
    return result;
  }

  async getHighestRevenueItems(period: 'day' | 'week' | 'month' | 'year' = 'month') {
    const cacheKey = `analytics:products:revenue:${period}`;
    const cached =
      await getCached<{ menuItemId: string; name: string; revenue: number }[]>(cacheKey);
    if (cached) return cached;

    const since = new Date();
    if (period === 'day') since.setDate(since.getDate() - 1);
    else if (period === 'week') since.setDate(since.getDate() - 7);
    else if (period === 'month') since.setMonth(since.getMonth() - 1);
    else since.setFullYear(since.getFullYear() - 1);

    const items = await prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where: { order: { createdAt: { gte: since } } },
      _sum: { unitPrice: true },
      orderBy: { _sum: { unitPrice: 'desc' } },
      take: 20,
    });

    const menuItemIds = items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, name: true },
    });
    const menuMap = new Map(menuItems.map((m) => [m.id, m.name]));

    const result = items.map((i) => ({
      menuItemId: i.menuItemId,
      name: menuMap.get(i.menuItemId) || 'Unknown',
      revenue: Number(i._sum.unitPrice || 0),
    }));

    await setCache(cacheKey, result);
    return result;
  }
}

export const productIntelligenceService = new ProductIntelligenceService();
