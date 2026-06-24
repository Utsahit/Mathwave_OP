import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

const giftCardSelect = {
  id: true,
  code: true,
  originalAmount: true,
  remainingAmount: true,
  isActive: true,
  expiresAt: true,
  createdAt: true,
} satisfies Prisma.GiftCardSelect;

export class GiftCardRepository {
  async findGiftCardByCode(code: string) {
    return prisma.giftCard.findUnique({
      where: { code },
      select: giftCardSelect,
    });
  }

  async findGiftCardById(id: string) {
    return prisma.giftCard.findUnique({
      where: { id },
      select: giftCardSelect,
    });
  }

  async listGiftCards(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      prisma.giftCard.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: giftCardSelect,
      }),
      prisma.giftCard.count(),
    ]);
    return { data, total, page, pageSize };
  }

  async createGiftCard(data: Prisma.GiftCardCreateInput) {
    return prisma.giftCard.create({
      data,
      select: giftCardSelect,
    });
  }

  async updateGiftCard(id: string, data: Prisma.GiftCardUpdateInput) {
    return prisma.giftCard.update({
      where: { id },
      data,
      select: giftCardSelect,
    });
  }

  async createRedemption(data: { giftCardId: string; orderId: string; amount: number }) {
    return prisma.giftCardRedemption.create({
      data,
      select: {
        id: true,
        giftCardId: true,
        orderId: true,
        amount: true,
        createdAt: true,
      },
    });
  }
}

export const giftCardRepository = new GiftCardRepository();
