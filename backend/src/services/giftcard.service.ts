import { prisma } from '../config/prisma';
import { getRedisClient } from '../config/redis';
import { giftCardRepository } from '../repositories/giftcard.repository';
import { notificationService } from './notification.service';
import { auditService } from './audit.service';
import { AppError } from '../utils/app-error';

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

async function invalidateGiftCardCache(code: string) {
  try {
    await getRedisClient().del(`giftcard:${code}`);
  } catch {
    // silent
  }
}

export class GiftCardService {
  async createGiftCard(
    data: {
      code: string;
      originalAmount: number;
      expiresAt?: Date;
    },
    adminUserId: string
  ) {
    const existing = await giftCardRepository.findGiftCardByCode(data.code);
    if (existing) {
      throw new AppError('Gift card code already exists.', 409, 'DUPLICATE_GIFTCARD');
    }

    const giftCard = await giftCardRepository.createGiftCard({
      code: data.code.toUpperCase(),
      originalAmount: data.originalAmount,
      remainingAmount: data.originalAmount,
      expiresAt: data.expiresAt,
    });

    auditService
      .logCreate(adminUserId, 'GiftCard', giftCard.id, {
        code: giftCard.code,
        amount: Number(giftCard.originalAmount),
      })
      .catch(() => {});

    return giftCard;
  }

  async validateGiftCard(code: string) {
    const cacheKey = `giftcard:${code}`;
    let giftCard = await getCached<{
      id: string;
      remainingAmount: number;
      isActive: boolean;
      expiresAt: Date | null;
    }>(cacheKey);

    if (!giftCard) {
      const dbCard = await giftCardRepository.findGiftCardByCode(code);
      if (!dbCard) {
        throw new AppError('Gift card not found.', 404, 'GIFTCARD_NOT_FOUND');
      }
      giftCard = {
        id: dbCard.id,
        remainingAmount: Number(dbCard.remainingAmount),
        isActive: dbCard.isActive,
        expiresAt: dbCard.expiresAt,
      };
      await setCache(cacheKey, giftCard);
    }

    if (!giftCard.isActive) {
      throw new AppError('Gift card is inactive.', 400, 'GIFTCARD_INACTIVE');
    }
    if (giftCard.expiresAt && new Date() > new Date(giftCard.expiresAt)) {
      throw new AppError('Gift card has expired.', 400, 'GIFTCARD_EXPIRED');
    }
    if (giftCard.remainingAmount <= 0) {
      throw new AppError('Gift card balance exhausted.', 400, 'GIFTCARD_EXHAUSTED');
    }

    return giftCard;
  }

  async redeemGiftCard(code: string, orderId: string, amount: number) {
    const giftCard = await this.validateGiftCard(code);
    const redeemAmount = amount;

    if (redeemAmount <= 0) {
      throw new AppError('Invalid redemption amount.', 400, 'INVALID_AMOUNT');
    }
    if (redeemAmount > giftCard.remainingAmount) {
      throw new AppError('Insufficient gift card balance.', 400, 'INSUFFICIENT_BALANCE');
    }

    const [result] = await prisma.$transaction(async (tx) => {
      // Atomic conditional decrement — guards against concurrent lost updates.
      // No read-then-write race: the UPDATE itself checks remainingAmount >= redeemAmount.
      // PostgreSQL's READ COMMITTED guarantees the WHERE clause evaluates on the latest
      // committed row at statement time, making this safe under concurrent load.
      const updateResult = await tx.$executeRawUnsafe(
        `UPDATE "GiftCard" SET "remainingAmount" = "remainingAmount" - $1
         WHERE "code" = $2 AND "remainingAmount" >= $1 AND "isActive" = true`,
        redeemAmount,
        code
      );

      if (updateResult === 0) {
        // Row either doesn't exist, is inactive, or balance became insufficient
        const fresh = await tx.giftCard.findUnique({
          where: { code },
          select: { remainingAmount: true, isActive: true },
        });
        if (!fresh) throw new AppError('Gift card not found.', 404, 'NOT_FOUND');
        if (!fresh.isActive)
          throw new AppError('Gift card is inactive.', 400, 'GIFTCARD_INACTIVE');
        if (Number(fresh.remainingAmount) < redeemAmount) {
          throw new AppError(
            'Insufficient gift card balance.',
            400,
            'INSUFFICIENT_BALANCE'
          );
        }
        throw new AppError(
          'Gift card redemption failed due to concurrent update.',
          409,
          'CONCURRENT_REDEMPTION'
        );
      }

      const updatedCard = await tx.giftCard.findUnique({
        where: { code },
        select: { id: true, remainingAmount: true },
      });

      const redemption = await tx.giftCardRedemption.create({
        data: { giftCardId: updatedCard!.id, orderId, amount: redeemAmount },
        select: { id: true, amount: true, createdAt: true },
      });
      return [redemption];
    });

    await invalidateGiftCardCache(code);

    notificationService
      .create(
        null,
        null,
        'GIFT_CARD_USED',
        'Gift Card Used',
        `₹${redeemAmount} redeemed from gift card ${code}.`,
        'IN_APP',
        { giftCardCode: code, amount: redeemAmount, orderId }
      )
      .catch(() => {});

    return { redemption: result, amountRedeemed: redeemAmount };
  }

  async listGiftCards(page = 1, pageSize = 20) {
    return giftCardRepository.listGiftCards(page, pageSize);
  }

  async deactivateGiftCard(id: string, adminUserId: string) {
    const existing = await giftCardRepository.findGiftCardById(id);
    if (!existing) {
      throw new AppError('Gift card not found.', 404, 'NOT_FOUND');
    }

    const updated = await giftCardRepository.updateGiftCard(id, { isActive: false });
    await invalidateGiftCardCache(existing.code);

    auditService
      .logUpdate(adminUserId, 'GiftCard', id, { isActive: true }, { isActive: false })
      .catch(() => {});

    return updated;
  }

  async updateGiftCard(
    id: string,
    data: {
      isActive?: boolean;
      expiresAt?: Date | null;
    },
    adminUserId: string
  ) {
    const existing = await giftCardRepository.findGiftCardById(id);
    if (!existing) {
      throw new AppError('Gift card not found.', 404, 'NOT_FOUND');
    }

    const updated = await giftCardRepository.updateGiftCard(id, data);
    await invalidateGiftCardCache(existing.code);

    auditService
      .logUpdate(
        adminUserId,
        'GiftCard',
        id,
        { code: existing.code },
        data as Record<string, unknown>
      )
      .catch(() => {});

    return updated;
  }
}

export const giftCardService = new GiftCardService();
