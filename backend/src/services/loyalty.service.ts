import { prisma } from '../config/prisma';
import { getRedisClient } from '../config/redis';
import { loyaltyRepository } from '../repositories/loyalty.repository';
import { notificationService } from './notification.service';
import { auditService } from './audit.service';
import { AppError } from '../utils/app-error';
import { LoyaltyTransactionType } from '@prisma/client';

const CACHE_TTL = 300;
const EARN_RATE = 10; // 10 points per ₹100 spent
const REDEEM_RATE = 10; // 100 points = ₹10

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

async function invalidateBalanceCache(userId: string) {
  try {
    await getRedisClient().del(`loyalty:balance:${userId}`);
  } catch {
    // silent
  }
}

export class LoyaltyService {
  async getBalance(userId: string) {
    const cacheKey = `loyalty:balance:${userId}`;
    const cached = await getCached<number>(cacheKey);
    if (cached !== null) return cached;

    const balance = await loyaltyRepository.findUserBalance(userId);
    await setCache(cacheKey, balance);
    return balance;
  }

  async getHistory(userId: string, page = 1, pageSize = 20) {
    return loyaltyRepository.findTransactionsByUserId(userId, page, pageSize);
  }

  async earnPoints(userId: string, amountSpent: number, orderId?: string) {
    const points = Math.floor(amountSpent / 100) * EARN_RATE;
    if (points <= 0) return 0;

    const [transaction] = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, loyaltyPoints: true },
      });
      if (!user) throw new AppError('User not found.', 404, 'NOT_FOUND');

      const newBalance = user.loyaltyPoints + points;
      await tx.user.update({
        where: { id: userId },
        data: { loyaltyPoints: newBalance },
      });

      const txn = await tx.loyaltyTransaction.create({
        data: {
          userId,
          type: 'EARN' as LoyaltyTransactionType,
          points,
          description: `Earned ${points} points from ₹${amountSpent} spend`,
          orderId,
        },
        select: {
          id: true,
          userId: true,
          type: true,
          points: true,
          description: true,
          orderId: true,
          createdAt: true,
        },
      });
      return [txn];
    });

    await invalidateBalanceCache(userId);

    notificationService
      .create(
        userId,
        null,
        'LOYALTY_POINTS_EARNED',
        'Points Earned',
        `You earned ${points} loyalty points!`,
        'IN_APP',
        { points, orderId }
      )
      .catch(() => {});

    return transaction;
  }

  async redeemPoints(userId: string, pointsToRedeem: number, orderId?: string) {
    const currentBalance = await this.getBalance(userId);
    if (pointsToRedeem > currentBalance) {
      throw new AppError(
        'Insufficient loyalty points balance.',
        400,
        'INSUFFICIENT_POINTS'
      );
    }

    const discountValue = (pointsToRedeem / 100) * REDEEM_RATE;

    const [transaction] = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, loyaltyPoints: true },
      });
      if (!user) throw new AppError('User not found.', 404, 'NOT_FOUND');
      if (user.loyaltyPoints < pointsToRedeem) {
        throw new AppError(
          'Insufficient loyalty points balance.',
          400,
          'INSUFFICIENT_POINTS'
        );
      }

      const newBalance = user.loyaltyPoints - pointsToRedeem;
      await tx.user.update({
        where: { id: userId },
        data: { loyaltyPoints: newBalance },
      });

      const txn = await tx.loyaltyTransaction.create({
        data: {
          userId,
          type: 'REDEEM' as LoyaltyTransactionType,
          points: -pointsToRedeem,
          description: `Redeemed ${pointsToRedeem} points for ₹${discountValue} discount`,
          orderId,
        },
        select: {
          id: true,
          userId: true,
          type: true,
          points: true,
          description: true,
          orderId: true,
          createdAt: true,
        },
      });
      return [txn];
    });

    await invalidateBalanceCache(userId);

    notificationService
      .create(
        userId,
        null,
        'LOYALTY_POINTS_REDEEMED',
        'Points Redeemed',
        `You redeemed ${pointsToRedeem} points for ₹${discountValue} off!`,
        'IN_APP',
        { points: pointsToRedeem, discountValue, orderId }
      )
      .catch(() => {});

    return { transaction, discountValue };
  }

  async referralBonus(referrerUserId: string, referredUserId: string) {
    const [referrerTxn, referredTxn] = await prisma.$transaction(async (tx) => {
      const [referrer, referred] = await Promise.all([
        tx.user.findUnique({
          where: { id: referrerUserId },
          select: { id: true, loyaltyPoints: true },
        }),
        tx.user.findUnique({
          where: { id: referredUserId },
          select: { id: true, loyaltyPoints: true },
        }),
      ]);
      if (!referrer || !referred) throw new AppError('User not found.', 404, 'NOT_FOUND');

      await tx.user.update({
        where: { id: referrerUserId },
        data: { loyaltyPoints: referrer.loyaltyPoints + 100 },
      });
      await tx.user.update({
        where: { id: referredUserId },
        data: { loyaltyPoints: referred.loyaltyPoints + 50 },
      });

      const [r1, r2] = await Promise.all([
        tx.loyaltyTransaction.create({
          data: {
            userId: referrerUserId,
            type: 'REFERRAL_BONUS',
            points: 100,
            description: 'Referral bonus',
          },
          select: {
            id: true,
            userId: true,
            type: true,
            points: true,
            description: true,
            createdAt: true,
          },
        }),
        tx.loyaltyTransaction.create({
          data: {
            userId: referredUserId,
            type: 'REFERRAL_BONUS',
            points: 50,
            description: 'Welcome referral bonus',
          },
          select: {
            id: true,
            userId: true,
            type: true,
            points: true,
            description: true,
            createdAt: true,
          },
        }),
      ]);
      return [r1, r2];
    });

    await Promise.all([
      invalidateBalanceCache(referrerUserId),
      invalidateBalanceCache(referredUserId),
    ]);

    notificationService
      .create(
        referredUserId,
        null,
        'REFERRAL_REWARD',
        'Welcome Bonus',
        'You received 50 referral bonus points!',
        'IN_APP'
      )
      .catch(() => {});
    notificationService
      .create(
        referrerUserId,
        null,
        'REFERRAL_REWARD',
        'Referral Reward',
        'You earned 100 referral bonus points!',
        'IN_APP'
      )
      .catch(() => {});

    return { referrerTxn, referredTxn };
  }

  async adjustPoints(
    userId: string,
    points: number,
    description: string,
    adminUserId: string
  ) {
    const [transaction] = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, loyaltyPoints: true },
      });
      if (!user) throw new AppError('User not found.', 404, 'NOT_FOUND');

      const newBalance = user.loyaltyPoints + points;
      if (newBalance < 0) {
        throw new AppError(
          'Resulting balance cannot be negative.',
          400,
          'NEGATIVE_BALANCE'
        );
      }

      await tx.user.update({
        where: { id: userId },
        data: { loyaltyPoints: newBalance },
      });

      const txn = await tx.loyaltyTransaction.create({
        data: {
          userId,
          type: 'ADJUSTMENT',
          points,
          description,
        },
        select: {
          id: true,
          userId: true,
          type: true,
          points: true,
          description: true,
          createdAt: true,
        },
      });
      return [txn];
    });

    await invalidateBalanceCache(userId);

    auditService
      .logCreate(adminUserId, 'LoyaltyAdjustment', transaction.id, {
        userId,
        points,
        description,
      })
      .catch(() => {});

    return transaction;
  }

  async expirePoints(userId: string, points: number) {
    const [transaction] = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, loyaltyPoints: true },
      });
      if (!user) throw new AppError('User not found.', 404, 'NOT_FOUND');

      const newBalance = Math.max(0, user.loyaltyPoints - points);
      const actualExpired = user.loyaltyPoints - newBalance;

      await tx.user.update({
        where: { id: userId },
        data: { loyaltyPoints: newBalance },
      });

      if (actualExpired > 0) {
        const txn = await tx.loyaltyTransaction.create({
          data: {
            userId,
            type: 'EXPIRED',
            points: -actualExpired,
            description: `${actualExpired} points expired`,
          },
          select: {
            id: true,
            userId: true,
            type: true,
            points: true,
            description: true,
            createdAt: true,
          },
        });
        return [txn];
      }
      return [null];
    });

    await invalidateBalanceCache(userId);
    return transaction;
  }
}

export const loyaltyService = new LoyaltyService();
