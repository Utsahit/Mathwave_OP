import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

const couponSelect = {
  id: true,
  code: true,
  type: true,
  value: true,
  minimumOrderValue: true,
  maxDiscount: true,
  usageLimit: true,
  usedCount: true,
  startsAt: true,
  expiresAt: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.CouponSelect;

export class CouponRepository {
  async findCouponByCode(code: string) {
    return prisma.coupon.findUnique({
      where: { code },
      select: couponSelect,
    });
  }

  async findCouponById(id: string) {
    return prisma.coupon.findUnique({
      where: { id },
      select: couponSelect,
    });
  }

  async listCoupons(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      prisma.coupon.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: couponSelect,
      }),
      prisma.coupon.count(),
    ]);
    return { data, total, page, pageSize };
  }

  async createCoupon(data: Prisma.CouponCreateInput) {
    return prisma.coupon.create({
      data,
      select: couponSelect,
    });
  }

  async updateCoupon(id: string, data: Prisma.CouponUpdateInput) {
    return prisma.coupon.update({
      where: { id },
      data,
      select: couponSelect,
    });
  }

  async deleteCoupon(id: string) {
    return prisma.coupon.delete({
      where: { id },
      select: { id: true },
    });
  }

  async incrementUsage(id: string) {
    return prisma.coupon.update({
      where: { id },
      data: { usedCount: { increment: 1 } },
      select: { id: true, usedCount: true },
    });
  }

  async createRedemption(data: { couponId: string; userId: string; orderId: string }) {
    return prisma.couponRedemption.create({
      data,
      select: { id: true, couponId: true, userId: true, orderId: true },
    });
  }
}

export const couponRepository = new CouponRepository();
