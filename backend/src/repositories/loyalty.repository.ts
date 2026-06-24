import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

const loyaltySelect = {
  id: true,
  userId: true,
  type: true,
  points: true,
  description: true,
  orderId: true,
  createdAt: true,
} satisfies Prisma.LoyaltyTransactionSelect;

export class LoyaltyRepository {
  async findTransactionsByUserId(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const where: Prisma.LoyaltyTransactionWhereInput = { userId };
    const [data, total] = await Promise.all([
      prisma.loyaltyTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: loyaltySelect,
      }),
      prisma.loyaltyTransaction.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }

  async createTransaction(data: Prisma.LoyaltyTransactionCreateInput) {
    return prisma.loyaltyTransaction.create({
      data,
      select: loyaltySelect,
    });
  }

  async findUserBalance(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { loyaltyPoints: true },
    });
    return user?.loyaltyPoints ?? 0;
  }

  async updateUserBalance(userId: string, points: number) {
    return prisma.user.update({
      where: { id: userId },
      data: { loyaltyPoints: points },
      select: { id: true, loyaltyPoints: true },
    });
  }
}

export const loyaltyRepository = new LoyaltyRepository();
