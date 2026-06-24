import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

// ── Select shape used on all public-facing queries ────────────────────────────
const PUBLIC_SELECT = {
  id: true,
  name: true,
  title: true,
  rating: true,
  comment: true,
  isFeatured: true,
  createdAt: true,
} satisfies Prisma.ReviewSelect;

// ── Select shape for admin (includes moderation fields) ───────────────────────
const ADMIN_SELECT = {
  id: true,
  name: true,
  email: true,
  title: true,
  rating: true,
  comment: true,
  isApproved: true,
  isFeatured: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
} satisfies Prisma.ReviewSelect;

export class ReviewRepository {
  // ── Public Queries ──────────────────────────────────────────────────────────

  async listApprovedReviews(filters: { rating?: number; page: number; limit: number }) {
    const where: Prisma.ReviewWhereInput = { isApproved: true };
    if (filters.rating) where.rating = filters.rating;

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        select: PUBLIC_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
      }),
      prisma.review.count({ where }),
    ]);

    return { items, total };
  }

  async listFeaturedReviews() {
    return prisma.review.findMany({
      where: { isApproved: true, isFeatured: true },
      select: PUBLIC_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats() {
    const [aggregate, distribution] = await Promise.all([
      prisma.review.aggregate({
        where: { isApproved: true },
        _avg: { rating: true },
        _count: { id: true },
      }),
      prisma.review.groupBy({
        by: ['rating'],
        where: { isApproved: true },
        _count: { id: true },
        orderBy: { rating: 'asc' },
      }),
    ]);

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of distribution) {
      ratingDistribution[row.rating] = row._count.id;
    }

    return {
      averageRating: Number((aggregate._avg.rating ?? 0).toFixed(2)),
      totalReviews: aggregate._count.id,
      ratingDistribution,
    };
  }

  // ── Spam Detection ──────────────────────────────────────────────────────────

  async findRecentByEmail(email: string, sinceMs: number) {
    const since = new Date(Date.now() - sinceMs);
    return prisma.review.findFirst({
      where: { email, createdAt: { gte: since } },
      select: { id: true, createdAt: true },
    });
  }

  async countByEmailSince(email: string, since: Date) {
    return prisma.review.count({
      where: { email, createdAt: { gte: since } },
    });
  }

  // ── Public Submit ───────────────────────────────────────────────────────────

  async createReview(data: {
    name: string;
    email: string;
    title?: string;
    rating: number;
    comment: string;
    userId?: string;
  }) {
    return prisma.review.create({
      data: {
        name: data.name,
        email: data.email,
        title: data.title,
        rating: data.rating,
        comment: data.comment,
        isApproved: false,
        isFeatured: false,
        userId: data.userId || null,
      },
      select: ADMIN_SELECT,
    });
  }

  // ── Admin Queries ───────────────────────────────────────────────────────────

  async listReviews(filters: {
    isApproved?: boolean;
    isFeatured?: boolean;
    rating?: number;
    search?: string;
    page: number;
    limit: number;
    branchIds?: string[];
  }) {
    const where: Prisma.ReviewWhereInput = {};

    if (filters.isApproved !== undefined) where.isApproved = filters.isApproved;
    if (filters.isFeatured !== undefined) where.isFeatured = filters.isFeatured;
    if (filters.rating !== undefined) where.rating = filters.rating;
    if (filters.branchIds) where.branchId = { in: filters.branchIds };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { comment: { contains: filters.search, mode: 'insensitive' } },
        { title: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        select: ADMIN_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
      }),
      prisma.review.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: string) {
    return prisma.review.findUnique({
      where: { id },
      select: ADMIN_SELECT,
    });
  }

  async updateReview(id: string, data: Prisma.ReviewUpdateInput) {
    return prisma.review.update({
      where: { id },
      data,
      select: ADMIN_SELECT,
    });
  }

  async deleteReview(id: string) {
    return prisma.review.delete({ where: { id } });
  }

  async setApproved(id: string, value: boolean) {
    return prisma.review.update({
      where: { id },
      data: { isApproved: value },
      select: ADMIN_SELECT,
    });
  }

  async setFeatured(id: string, value: boolean) {
    return prisma.review.update({
      where: { id },
      data: { isFeatured: value },
      select: ADMIN_SELECT,
    });
  }
}

export const reviewRepository = new ReviewRepository();
