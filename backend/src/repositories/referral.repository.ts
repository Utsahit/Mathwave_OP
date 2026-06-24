import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

const referralSelect = {
  id: true,
  referrerUserId: true,
  referredUserId: true,
  rewardGranted: true,
  createdAt: true,
} satisfies Prisma.ReferralSelect;

export class ReferralRepository {
  async findReferral(referrerUserId: string, referredUserId: string) {
    return prisma.referral.findUnique({
      where: {
        referrerUserId_referredUserId: { referrerUserId, referredUserId },
      },
      select: referralSelect,
    });
  }

  async createReferral(data: Prisma.ReferralCreateInput) {
    return prisma.referral.create({
      data,
      select: referralSelect,
    });
  }

  async markRewardGranted(id: string) {
    return prisma.referral.update({
      where: { id },
      data: { rewardGranted: true },
      select: { id: true, rewardGranted: true },
    });
  }

  async listReferralsByUser(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const where: Prisma.ReferralWhereInput = { referrerUserId: userId };
    const [data, total] = await Promise.all([
      prisma.referral.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: referralSelect,
      }),
      prisma.referral.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }
}

export const referralRepository = new ReferralRepository();
