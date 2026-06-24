import { referralRepository } from '../repositories/referral.repository';
import { loyaltyService } from './loyalty.service';
import { auditService } from './audit.service';
import { AppError } from '../utils/app-error';
import { prisma } from '../config/prisma';

export class ReferralService {
  async createReferral(referrerUserId: string, referredUserId: string) {
    if (referrerUserId === referredUserId) {
      throw new AppError('Cannot refer yourself.', 400, 'SELF_REFERRAL');
    }

    const [referrer, referred] = await Promise.all([
      prisma.user.findUnique({ where: { id: referrerUserId }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: referredUserId }, select: { id: true } }),
    ]);

    if (!referrer) throw new AppError('Referrer not found.', 404, 'NOT_FOUND');
    if (!referred) throw new AppError('Referred user not found.', 404, 'NOT_FOUND');

    const existing = await referralRepository.findReferral(
      referrerUserId,
      referredUserId
    );
    if (existing) {
      throw new AppError('Referral already exists.', 409, 'DUPLICATE_REFERRAL');
    }

    const referral = await referralRepository.createReferral({
      referrerUser: { connect: { id: referrerUserId } },
      referredUser: { connect: { id: referredUserId } },
    });

    return referral;
  }

  async grantBonus(referralId: string) {
    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
      select: {
        id: true,
        referrerUserId: true,
        referredUserId: true,
        rewardGranted: true,
      },
    });

    if (!referral) {
      throw new AppError('Referral not found.', 404, 'NOT_FOUND');
    }
    if (referral.rewardGranted) {
      throw new AppError(
        'Referral reward already granted.',
        400,
        'REWARD_ALREADY_GRANTED'
      );
    }

    await loyaltyService.referralBonus(referral.referrerUserId, referral.referredUserId);
    await referralRepository.markRewardGranted(referralId);

    auditService
      .logCreate(null, 'ReferralReward', referralId, {
        referrerUserId: referral.referrerUserId,
        referredUserId: referral.referredUserId,
      })
      .catch(() => {});
  }

  async listReferrals(userId: string, page = 1, pageSize = 20) {
    return referralRepository.listReferralsByUser(userId, page, pageSize);
  }
}

export const referralService = new ReferralService();
