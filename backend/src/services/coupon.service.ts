import { prisma } from '../config/prisma';
import { getRedisClient } from '../config/redis';
import { couponRepository } from '../repositories/coupon.repository';
import { notificationService } from './notification.service';
import { auditService } from './audit.service';
import { AppError } from '../utils/app-error';
import { CouponType } from '@prisma/client';

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

async function invalidateCouponCache(code: string) {
  try {
    await getRedisClient().del(`coupon:${code}`);
  } catch {
    // silent
  }
}

export class CouponService {
  async createCoupon(
    data: {
      code: string;
      type: CouponType;
      value: number;
      minimumOrderValue?: number;
      maxDiscount?: number;
      usageLimit?: number;
      startsAt: Date;
      expiresAt: Date;
    },
    adminUserId: string
  ) {
    const existing = await couponRepository.findCouponByCode(data.code);
    if (existing) {
      throw new AppError('Coupon code already exists.', 409, 'DUPLICATE_COUPON');
    }

    const coupon = await couponRepository.createCoupon({
      code: data.code.toUpperCase(),
      type: data.type,
      value: data.value,
      minimumOrderValue: data.minimumOrderValue,
      maxDiscount: data.maxDiscount,
      usageLimit: data.usageLimit,
      startsAt: data.startsAt,
      expiresAt: data.expiresAt,
    });

    auditService
      .logCreate(adminUserId, 'Coupon', coupon.id, {
        code: coupon.code,
        type: coupon.type,
      })
      .catch(() => {});
    return coupon;
  }

  async updateCoupon(
    id: string,
    data: {
      type?: CouponType;
      value?: number;
      minimumOrderValue?: number;
      maxDiscount?: number;
      usageLimit?: number;
      startsAt?: Date;
      expiresAt?: Date;
      isActive?: boolean;
    },
    adminUserId: string
  ) {
    const existing = await couponRepository.findCouponById(id);
    if (!existing) {
      throw new AppError('Coupon not found.', 404, 'NOT_FOUND');
    }

    const updated = await couponRepository.updateCoupon(id, data);
    await invalidateCouponCache(existing.code);

    auditService
      .logUpdate(
        adminUserId,
        'Coupon',
        id,
        { code: existing.code },
        { code: updated.code }
      )
      .catch(() => {});
    return updated;
  }

  async deleteCoupon(id: string, adminUserId: string) {
    const existing = await couponRepository.findCouponById(id);
    if (!existing) {
      throw new AppError('Coupon not found.', 404, 'NOT_FOUND');
    }

    await couponRepository.deleteCoupon(id);
    await invalidateCouponCache(existing.code);

    auditService
      .logDelete(adminUserId, 'Coupon', id, { code: existing.code })
      .catch(() => {});
  }

  async validateCoupon(code: string, orderValue: number) {
    const cacheKey = `coupon:${code}`;
    let coupon = await getCached<{
      id: string;
      type: string;
      value: number;
      minimumOrderValue: number | null;
      maxDiscount: number | null;
      usageLimit: number | null;
      usedCount: number;
      startsAt: string;
      expiresAt: string;
      isActive: boolean;
    }>(cacheKey);

    if (!coupon) {
      const dbCoupon = await couponRepository.findCouponByCode(code);
      if (!dbCoupon) {
        throw new AppError('Coupon not found.', 404, 'COUPON_NOT_FOUND');
      }
      coupon = {
        id: dbCoupon.id,
        type: dbCoupon.type,
        value: Number(dbCoupon.value),
        minimumOrderValue: dbCoupon.minimumOrderValue
          ? Number(dbCoupon.minimumOrderValue)
          : null,
        maxDiscount: dbCoupon.maxDiscount ? Number(dbCoupon.maxDiscount) : null,
        usageLimit: dbCoupon.usageLimit,
        usedCount: dbCoupon.usedCount,
        startsAt: dbCoupon.startsAt.toISOString(),
        expiresAt: dbCoupon.expiresAt.toISOString(),
        isActive: dbCoupon.isActive,
      };
      await setCache(cacheKey, coupon);
    }

    const now = new Date();
    const startsAt = new Date(coupon.startsAt);
    const expiresAt = new Date(coupon.expiresAt);

    if (!coupon.isActive) {
      throw new AppError('Coupon is inactive.', 400, 'COUPON_INACTIVE');
    }
    if (now < startsAt) {
      throw new AppError('Coupon is not yet valid.', 400, 'COUPON_NOT_STARTED');
    }
    if (now > expiresAt) {
      throw new AppError('Coupon has expired.', 400, 'COUPON_EXPIRED');
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new AppError('Coupon usage limit reached.', 400, 'COUPON_USAGE_LIMIT');
    }
    if (coupon.minimumOrderValue !== null && orderValue < coupon.minimumOrderValue) {
      throw new AppError(
        `Minimum order value of ₹${coupon.minimumOrderValue} required.`,
        400,
        'MINIMUM_ORDER_VALUE'
      );
    }

    return coupon;
  }

  calculateDiscount(
    coupon: {
      type: string;
      value: number;
      maxDiscount: number | null;
    },
    orderValue: number
  ): number {
    if (coupon.type === 'PERCENTAGE') {
      const discount = (orderValue * coupon.value) / 100;
      return coupon.maxDiscount !== null
        ? Math.min(discount, coupon.maxDiscount)
        : discount;
    }
    return coupon.value;
  }

  async applyCoupon(code: string, orderValue: number, userId: string, orderId: string) {
    const coupon = await this.validateCoupon(code, orderValue);
    const discount = this.calculateDiscount(coupon, orderValue);

    const [result] = await prisma.$transaction(async (tx) => {
      const fresh = await tx.coupon.findUnique({
        where: { code },
        select: { id: true, usedCount: true, usageLimit: true },
      });
      if (!fresh) throw new AppError('Coupon not found.', 404, 'NOT_FOUND');
      if (fresh.usageLimit !== null && fresh.usedCount >= fresh.usageLimit) {
        throw new AppError('Coupon usage limit reached.', 400, 'COUPON_USAGE_LIMIT');
      }

      await tx.coupon.update({
        where: { id: fresh.id },
        data: { usedCount: { increment: 1 } },
      });

      const redemption = await tx.couponRedemption.create({
        data: { couponId: fresh.id, userId, orderId },
        select: { id: true },
      });
      return [redemption];
    });

    await invalidateCouponCache(code);

    auditService
      .logCreate(userId, 'CouponRedemption', result.id, {
        coupon: code,
        discount,
        orderId,
      })
      .catch(() => {});

    notificationService
      .create(
        userId,
        null,
        'COUPON_APPLIED',
        'Coupon Applied',
        `Coupon ${code} applied! You saved ₹${discount}.`,
        'IN_APP',
        { couponCode: code, discount, orderId }
      )
      .catch(() => {});

    return { discount, couponId: coupon.id };
  }

  async listCoupons(page = 1, pageSize = 20) {
    return couponRepository.listCoupons(page, pageSize);
  }
}

export const couponService = new CouponService();
