import { prisma } from '../config/prisma';
import { auditService } from './audit.service';
import { AppError } from '../utils/app-error';
import { AuthRepository } from '../repositories/auth.repository';

const authRepository = new AuthRepository();

export class DataPrivacyService {
  async requestAccountDeletion(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isDeleted: true },
    });

    if (!user) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }

    if (user.isDeleted) {
      throw new AppError(
        'Account is already scheduled for deletion.',
        400,
        'ALREADY_DELETED'
      );
    }

    await Promise.all([
      prisma.user.update({
        where: { id: userId },
        data: {
          isDeleted: true,
          name: 'Deleted User',
          email: `deleted-${userId}@elixirandoak.in`,
        },
        select: { id: true },
      }),
      authRepository.deleteUserSessions(userId),
    ]);

    await auditService.logCreate(userId, 'ACCOUNT_DELETION', userId, { deleted: true });

    return { success: true, message: 'Account scheduled for deletion' };
  }

  async exportPersonalData(userId: string) {
    const [
      user,
      orders,
      reservations,
      reviews,
      supportTickets,
      favorites,
      addresses,
      loyaltyTransactions,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          roleId: true,
          loyaltyPoints: true,
          createdAt: true,
          updatedAt: true,
          birthday: true,
          marketingOptIn: true,
          lastOrderAt: true,
          role: { select: { name: true } },
        },
      }),
      prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          subtotalAmount: true,
          taxAmount: true,
          couponDiscount: true,
          loyaltyDiscount: true,
          giftCardDiscount: true,
          finalAmount: true,
          status: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              menuItemId: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
            },
          },
        },
      }),
      prisma.reservation.findMany({
        where: { customerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          reservationCode: true,
          date: true,
          timeSlot: true,
          guests: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.review.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          rating: true,
          comment: true,
          title: true,
          isApproved: true,
          createdAt: true,
        },
      }),
      prisma.supportTicket.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          subject: true,
          message: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.favoriteMenuItem.findMany({
        where: { userId },
        select: {
          id: true,
          menuItemId: true,
          createdAt: true,
        },
      }),
      prisma.customerAddress.findMany({
        where: { userId },
        select: {
          id: true,
          label: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          isDefault: true,
        },
      }),
      prisma.loyaltyTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          points: true,
          description: true,
          createdAt: true,
        },
      }),
    ]);

    if (!user) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }

    await auditService.logCreate(userId, 'DATA_EXPORT', userId, { exported: true });

    return {
      profile: user,
      orders,
      reservations,
      reviews,
      supportTickets,
      favorites,
      addresses,
      loyaltyTransactions,
    };
  }
}

export const dataPrivacyService = new DataPrivacyService();
