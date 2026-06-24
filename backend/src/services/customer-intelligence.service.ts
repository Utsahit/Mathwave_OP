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

type RfmScore = {
  recency: number;
  frequency: number;
  monetary: number;
  totalScore: number;
};
type CustomerSegment =
  | 'Champions'
  | 'Loyal Customers'
  | 'Potential Loyalists'
  | 'At Risk'
  | 'Lost Customers';

export class CustomerIntelligenceService {
  async getRfmAnalysis() {
    const cacheKey = 'analytics:customers:rfm';
    const cached = await getCached<{
      segments: Record<CustomerSegment, number>;
      averageRfm: RfmScore;
    }>(cacheKey);
    if (cached) return cached;

    const users = await prisma.user.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        orders: {
          select: { createdAt: true, finalAmount: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const now = Date.now();
    let totalR = 0,
      totalF = 0,
      totalM = 0,
      count = 0;
    const segments: Record<string, number> = {
      Champions: 0,
      'Loyal Customers': 0,
      'Potential Loyalists': 0,
      'At Risk': 0,
      'Lost Customers': 0,
    };

    for (const user of users) {
      if (user.orders.length === 0) {
        segments['Lost Customers']++;
        continue;
      }
      count++;

      const daysSinceLast = (now - user.orders[0].createdAt.getTime()) / 86400000;
      const recency =
        daysSinceLast <= 7
          ? 5
          : daysSinceLast <= 30
            ? 4
            : daysSinceLast <= 90
              ? 3
              : daysSinceLast <= 180
                ? 2
                : 1;
      const frequency =
        user.orders.length >= 10
          ? 5
          : user.orders.length >= 5
            ? 4
            : user.orders.length >= 3
              ? 3
              : user.orders.length >= 2
                ? 2
                : 1;
      const totalSpent = user.orders.reduce((s, o) => s + Number(o.finalAmount || 0), 0);
      const monetary =
        totalSpent >= 50000
          ? 5
          : totalSpent >= 20000
            ? 4
            : totalSpent >= 10000
              ? 3
              : totalSpent >= 5000
                ? 2
                : 1;

      totalR += recency;
      totalF += frequency;
      totalM += monetary;

      if (recency >= 4 && frequency >= 4 && monetary >= 4) segments['Champions']++;
      else if (frequency >= 3 && monetary >= 3) segments['Loyal Customers']++;
      else if (recency >= 3 && frequency >= 2) segments['Potential Loyalists']++;
      else if (recency <= 2 && frequency >= 2) segments['At Risk']++;
      else segments['Lost Customers']++;
    }

    const averageRfm: RfmScore = {
      recency: count > 0 ? Math.round((totalR / count) * 10) / 10 : 0,
      frequency: count > 0 ? Math.round((totalF / count) * 10) / 10 : 0,
      monetary: count > 0 ? Math.round((totalM / count) * 10) / 10 : 0,
      totalScore:
        count > 0 ? Math.round(((totalR + totalF + totalM) / count) * 10) / 10 : 0,
    };

    const result = { segments: segments as Record<CustomerSegment, number>, averageRfm };
    await setCache(cacheKey, result);
    return result;
  }

  async getCohortAnalysis() {
    const cacheKey = 'analytics:customers:cohort';
    const cached = await getCached<{
      cohorts: {
        month: string;
        customers: number;
        retained: number;
        retentionRate: number;
      }[];
    }>(cacheKey);
    if (cached) return cached;

    const users = await prisma.user.findMany({
      where: { isDeleted: false },
      select: { createdAt: true, orders: { select: { createdAt: true } } },
    });

    const cohortMap = new Map<string, { total: number; retained: number }>();
    for (const user of users) {
      const cohort = user.createdAt.toISOString().slice(0, 7);
      const entry = cohortMap.get(cohort) || { total: 0, retained: 0 };
      entry.total++;
      if (user.orders.length > 0) entry.retained++;
      cohortMap.set(cohort, entry);
    }

    const cohorts = Array.from(cohortMap.entries())
      .map(([month, data]) => ({
        month,
        customers: data.total,
        retained: data.retained,
        retentionRate:
          data.total > 0 ? Math.round((data.retained / data.total) * 10000) / 100 : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const result = { cohorts };
    await setCache(cacheKey, result);
    return result;
  }
}

export const customerIntelligenceService = new CustomerIntelligenceService();
