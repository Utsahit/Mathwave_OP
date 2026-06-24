import { prisma } from '../config/prisma';
import { getRedisClient } from '../config/redis';
import { SegmentType } from '@prisma/client';
import { logger } from '../config/logger';

const SEGMENT_CACHE_TTL = 300;

export class SegmentationService {
  async recalculateAll() {
    logger.info('Starting full segment recalculation...');

    const customers = await prisma.user.findMany({
      where: { role: { name: 'CUSTOMER' }, isDeleted: false },
      select: {
        id: true,
        loyaltyPoints: true,
        createdAt: true,
        lastOrderAt: true,
        _count: { select: { orders: true } },
      },
    });

    const now = new Date();
    const segments: { userId: string; segment: SegmentType }[] = [];

    // Batch fetch lifetime spend for all customers with orders
    const customerIdsWithOrders = customers
      .filter((c) => c._count.orders > 0)
      .map((c) => c.id);
    const spendData =
      customerIdsWithOrders.length > 0
        ? await prisma.order.groupBy({
            by: ['userId'],
            where: {
              userId: { in: customerIdsWithOrders },
              status: { not: 'CANCELLED' },
            },
            _sum: { totalAmount: true },
          })
        : [];
    const spendMap = new Map(
      spendData.map((s) => [s.userId, Number(s._sum.totalAmount || 0)])
    );

    for (const customer of customers) {
      const orderCount = customer._count.orders;
      const daysSinceLastOrder = customer.lastOrderAt
        ? Math.floor(
            (now.getTime() - customer.lastOrderAt.getTime()) / (1000 * 60 * 60 * 24)
          )
        : null;
      const daysSinceSignup = Math.floor(
        (now.getTime() - customer.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      let primarySegment: SegmentType | null = null;

      if (orderCount === 0 && daysSinceSignup <= 30) {
        primarySegment = 'NEW_CUSTOMER';
      } else if (customer.loyaltyPoints > 0) {
        primarySegment = 'LOYALTY_MEMBER';
      }

      if (daysSinceLastOrder !== null && daysSinceLastOrder >= 90) {
        primarySegment = 'CHURNED';
      } else if (daysSinceLastOrder !== null && daysSinceLastOrder >= 30) {
        primarySegment = 'AT_RISK';
      }

      if (orderCount > 10) {
        primarySegment = 'REGULAR';
      }

      if (orderCount > 0) {
        const totalSpend = spendMap.get(customer.id) || 0;
        if (totalSpend > 50000) {
          primarySegment = 'VIP';
        }
      }

      if (primarySegment) {
        segments.push({ userId: customer.id, segment: primarySegment });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.customerSegment.deleteMany({});
      if (segments.length > 0) {
        await tx.customerSegment.createMany({ data: segments });
      }
    });

    try {
      await getRedisClient().del('analytics:segments');
    } catch {}

    logger.info({ count: segments.length }, 'Segment recalculation complete');
    return { assigned: segments.length };
  }

  async getUserSegments(userId: string) {
    const cacheKey = `segment:${userId}`;
    try {
      const cached = await getRedisClient().get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}

    const segments = await prisma.customerSegment.findMany({
      where: { userId },
      select: { segment: true, assignedAt: true },
      orderBy: { assignedAt: 'desc' },
    });

    try {
      await getRedisClient().set(
        cacheKey,
        JSON.stringify(segments),
        'EX',
        SEGMENT_CACHE_TTL
      );
    } catch {}

    return segments;
  }

  async listSegments(page: number, limit: number, segmentType?: SegmentType) {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (segmentType) where.segment = segmentType;

    const [items, total] = await Promise.all([
      prisma.customerSegment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { assignedAt: 'desc' },
        select: {
          id: true,
          segment: true,
          assignedAt: true,
          userId: true,
        },
      }),
      prisma.customerSegment.count({ where }),
    ]);
    return { data: items, total, page, limit };
  }

  async getSegmentStats() {
    const groups = await prisma.customerSegment.groupBy({
      by: ['segment'],
      _count: { userId: true },
    });
    const stats: Record<string, number> = {};
    for (const g of groups) {
      stats[g.segment] = g._count.userId;
    }
    return stats;
  }
}

export const segmentationService = new SegmentationService();
