import { prisma } from '../config/prisma';
import { getRedisClient } from '../config/redis';

const RECOMMENDATION_TTL = 300;

export class RecommendationService {
  async getRecommendations(userId: string, limit = 10) {
    const cacheKey = `recommendations:${userId}`;

    try {
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      // proceed
    }

    const favoriteCategoryIds = await this.getFavoriteCategoryIds(userId);

    const pastOrderItemIds = await this.getPastOrderItemIds(userId);

    const popularItemIds = await this.getPopularItemIds(limit, favoriteCategoryIds);

    const combined = new Set<string>();

    if (favoriteCategoryIds.length > 0) {
      const items = await prisma.menuItem.findMany({
        where: {
          categoryId: { in: favoriteCategoryIds },
          isActive: true,
          isDeleted: false,
        },
        select: { id: true, name: true, slug: true, price: true, image: true, tag: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      for (const item of items) combined.add(item.id);
    }

    for (const id of popularItemIds) {
      combined.add(id);
    }

    if (pastOrderItemIds.length > 0 && combined.size < limit * 2) {
      const items = await prisma.menuItem.findMany({
        where: {
          id: { in: pastOrderItemIds.slice(0, limit * 2 - combined.size) },
          isActive: true,
          isDeleted: false,
        },
        select: { id: true, name: true, slug: true, price: true, image: true, tag: true },
      });
      for (const item of items) combined.add(item.id);
    }

    const result = await prisma.menuItem.findMany({
      where: {
        id: { in: Array.from(combined).slice(0, limit) },
        isActive: true,
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        image: true,
        tag: true,
        categoryId: true,
      },
    });

    try {
      const redis = getRedisClient();
      await redis.set(cacheKey, JSON.stringify(result), 'EX', RECOMMENDATION_TTL);
    } catch {
      // silent
    }

    return result;
  }

  private async getFavoriteCategoryIds(userId: string): Promise<string[]> {
    const favorites = await prisma.favoriteMenuItem.findMany({
      where: { userId },
      include: { menuItem: { select: { categoryId: true } } },
    });
    return [...new Set(favorites.map((f) => f.menuItem.categoryId))];
  }

  private async getPastOrderItemIds(userId: string): Promise<string[]> {
    const orders = await prisma.order.findMany({
      where: { userId, status: { in: ['DELIVERED', 'CONFIRMED'] } },
      select: { items: { select: { menuItemId: true } } },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });
    return [...new Set(orders.flatMap((o) => o.items.map((i) => i.menuItemId)))];
  }

  private async getPopularItemIds(
    limit: number,
    _excludeCategoryIds: string[]
  ): Promise<string[]> {
    const popular = await prisma.orderItem.groupBy({
      by: ['menuItemId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });
    return popular.map((p) => p.menuItemId);
  }
}

export const recommendationService = new RecommendationService();
