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

export class ForecastService {
  async getRevenueForecast() {
    const cacheKey = 'analytics:forecast:revenue';
    const cached = await getCached<{
      forecast7day: number;
      forecast30day: number;
      forecast90day: number;
    }>(cacheKey);
    if (cached) return cached;

    const paidStatuses: OrderStatus[] = [
      'CONFIRMED',
      'PREPARING',
      'READY',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ];

    // Daily revenue for last 90 days (aggregate only, no row loading)
    const dailyRev = await prisma.order.groupBy({
      by: ['createdAt'],
      where: {
        status: { in: paidStatuses },
        createdAt: { gte: new Date(Date.now() - 90 * 86400000) },
      },
      _sum: { finalAmount: true },
    });

    // Group by day manually (Prisma groupBy returns DateTime granularity)
    const dayMap = new Map<string, number>();
    for (const row of dailyRev) {
      const day = row.createdAt.toISOString().slice(0, 10);
      dayMap.set(day, (dayMap.get(day) || 0) + Number(row._sum.finalAmount || 0));
    }

    const dailyValues = Array.from(dayMap.values());
    const avgDaily =
      dailyValues.length > 0
        ? dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length
        : 0;

    // Simple moving average trend
    const recent7 = dailyValues.slice(-7);
    const recentAvg =
      recent7.length > 0 ? recent7.reduce((a, b) => a + b, 0) / recent7.length : avgDaily;
    const trendFactor = avgDaily > 0 ? recentAvg / avgDaily : 1;

    const result = {
      forecast7day: Math.round(avgDaily * trendFactor * 7 * 100) / 100,
      forecast30day: Math.round(avgDaily * trendFactor * 30 * 100) / 100,
      forecast90day: Math.round(avgDaily * trendFactor * 90 * 100) / 100,
    };
    await setCache(cacheKey, result);
    return result;
  }

  async getOrderForecast() {
    const cacheKey = 'analytics:forecast:orders';
    const cached = await getCached<{
      forecastDaily: number;
      forecastWeekly: number;
      forecastMonthly: number;
    }>(cacheKey);
    if (cached) return cached;

    const dailyOrders = await prisma.order.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: new Date(Date.now() - 90 * 86400000) } },
      _count: { id: true },
    });

    const dayMap = new Map<string, number>();
    for (const row of dailyOrders) {
      const day = row.createdAt.toISOString().slice(0, 10);
      dayMap.set(day, (dayMap.get(day) || 0) + row._count.id);
    }

    const dailyValues = Array.from(dayMap.values());
    const avgDaily =
      dailyValues.length > 0
        ? dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length
        : 0;
    const recent7 = dailyValues.slice(-7);
    const recentAvg =
      recent7.length > 0 ? recent7.reduce((a, b) => a + b, 0) / recent7.length : avgDaily;
    const trendFactor = avgDaily > 0 ? recentAvg / avgDaily : 1;

    const result = {
      forecastDaily: Math.round(avgDaily * trendFactor * 100) / 100,
      forecastWeekly: Math.round(avgDaily * trendFactor * 7 * 100) / 100,
      forecastMonthly: Math.round(avgDaily * trendFactor * 30 * 100) / 100,
    };
    await setCache(cacheKey, result);
    return result;
  }
}

export const forecastService = new ForecastService();
