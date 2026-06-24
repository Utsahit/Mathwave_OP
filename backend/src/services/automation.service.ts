import { prisma } from '../config/prisma';
import { queueService } from './queue.service';
import { notificationService } from './notification.service';
import { AppError } from '../utils/app-error';
import { logger } from '../config/logger';
import { env } from '../config/env';

export class AutomationService {
  async listAutomations(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.marketingAutomation.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, trigger: true, isActive: true, createdAt: true },
      }),
      prisma.marketingAutomation.count(),
    ]);
    return { data: items, total, page, limit };
  }

  async createAutomation(data: { name: string; trigger: string }) {
    return prisma.marketingAutomation.create({
      data: { name: data.name, trigger: data.trigger as any },
      select: { id: true, name: true, trigger: true, isActive: true, createdAt: true },
    });
  }

  async updateAutomation(id: string, data: { name?: string; isActive?: boolean }) {
    const existing = await prisma.marketingAutomation.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing)
      throw new AppError('Automation not found.', 404, 'AUTOMATION_NOT_FOUND');
    return prisma.marketingAutomation.update({
      where: { id },
      data,
      select: { id: true, name: true, trigger: true, isActive: true },
    });
  }

  async processBirthdayRewards() {
    const automations = await prisma.marketingAutomation.findMany({
      where: { trigger: 'BIRTHDAY', isActive: true },
      select: { id: true },
    });
    if (automations.length === 0) return { processed: 0 };

    const today = new Date();
    const todayMonthDay = `${today.getMonth() + 1}-${today.getDate()}`;

    const birthdayUsers = await prisma.user.findMany({
      where: {
        birthday: { not: null },
        marketingOptIn: true,
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        birthday: true,
      },
    });

    const todayBirthdays = birthdayUsers.filter((u) => {
      if (!u.birthday) return false;
      const bd = `${u.birthday.getMonth() + 1}-${u.birthday.getDate()}`;
      return bd === todayMonthDay;
    });

    for (const user of todayBirthdays) {
      const couponCode = `BDAY-${user.id.substring(0, 6).toUpperCase()}-${today.getFullYear()}`;

      await prisma.coupon.upsert({
        where: { code: couponCode },
        update: {},
        create: {
          code: couponCode,
          type: 'PERCENTAGE',
          value: 15,
          maxDiscount: 500,
          usageLimit: 1,
          startsAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
      });

      await queueService.enqueue('SEND_EMAIL', {
        to: user.email,
        subject: "Happy Birthday! Here's a special treat from Elixir & Oak 🎂",
        html: `<h2>Happy Birthday, ${user.name}!</h2><p>Enjoy 15% off your next order with code: <strong>${couponCode}</strong></p><p>Valid for 7 days.</p>`,
      });

      notificationService
        .create(
          user.id,
          null,
          'LOYALTY_POINTS_EARNED' as any,
          'Happy Birthday!',
          `Enjoy 15% off with code ${couponCode}. Valid for 7 days!`,
          'IN_APP',
          { couponCode }
        )
        .catch(() => {});
    }

    logger.info({ count: todayBirthdays.length }, 'Birthday rewards processed');
    return { processed: todayBirthdays.length };
  }

  async processAbandonedCarts() {
    const automations = await prisma.marketingAutomation.findMany({
      where: { trigger: 'ABANDONED_CART', isActive: true },
      select: { id: true },
    });
    if (automations.length === 0) return { processed: 0 };

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const abandonedCarts = await prisma.cart.findMany({
      where: {
        userId: { not: null },
        createdAt: { lt: twoHoursAgo },
      },
      select: {
        id: true,
        userId: true,
        createdAt: true,
        items: {
          select: { quantity: true, menuItem: { select: { name: true } } },
        },
        user: {
          select: { email: true, name: true, marketingOptIn: true },
        },
      },
    });

    const filtered = abandonedCarts.filter((c) => c.user && c.user.marketingOptIn);

    for (const cart of filtered) {
      const itemNames = cart.items.map((i) => i.menuItem.name).join(', ');

      await queueService.enqueue('SEND_EMAIL', {
        to: cart.user!.email,
        subject: 'Your cart is waiting!',
        html: `<h2>Hi ${cart.user!.name},</h2><p>You left some items in your cart: ${itemNames}</p><p><a href="${env.NODE_ENV === 'production' ? 'https://elixirandoak.in' : 'http://localhost:3000'}/cart">Return to cart</a></p>`,
      });

      notificationService
        .create(
          cart.userId!,
          null,
          'SYSTEM' as any,
          'Complete Your Order',
          `You left ${itemNames} in your cart. Come back to complete your order!`,
          'IN_APP'
        )
        .catch(() => {});
    }

    logger.info({ count: filtered.length }, 'Abandoned cart reminders sent');
    return { processed: filtered.length };
  }

  async processWinBackCampaigns() {
    const automations = await prisma.marketingAutomation.findMany({
      where: { trigger: 'WIN_BACK', isActive: true },
      select: { id: true },
    });
    if (automations.length === 0) return { processed: 0 };

    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const churnedUsers = await prisma.user.findMany({
      where: {
        lastOrderAt: { lt: sixtyDaysAgo, not: null },
        marketingOptIn: true,
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        lastOrderAt: true,
      },
    });

    for (const user of churnedUsers) {
      const couponCode = `WELCOME-${user.id.substring(0, 6).toUpperCase()}`;

      await prisma.coupon.upsert({
        where: { code: couponCode },
        update: {},
        create: {
          code: couponCode,
          type: 'PERCENTAGE',
          value: 20,
          maxDiscount: 300,
          usageLimit: 1,
          startsAt: new Date(),
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
      });

      await queueService.enqueue('SEND_EMAIL', {
        to: user.email,
        subject: "We miss you! Here's 20% off your next visit",
        html: `<h2>We miss you, ${user.name}!</h2><p>It's been a while. Enjoy 20% off your next order with code: <strong>${couponCode}</strong></p><p>Valid for 14 days.</p>`,
      });

      notificationService
        .create(
          user.id,
          null,
          'LOYALTY_POINTS_EARNED' as any,
          'We Miss You!',
          `Here's 20% off your next order with code ${couponCode}. Valid for 14 days!`,
          'IN_APP',
          { couponCode }
        )
        .catch(() => {});
    }

    logger.info({ count: churnedUsers.length }, 'Win-back campaigns processed');
    return { processed: churnedUsers.length };
  }

  async processLoyaltyMilestones() {
    const automations = await prisma.marketingAutomation.findMany({
      where: { trigger: 'LOYALTY_MILESTONE', isActive: true },
      select: { id: true },
    });
    if (automations.length === 0) return { processed: 0 };

    const milestoneUsers = await prisma.user.findMany({
      where: {
        loyaltyPoints: { gte: 1000 },
        marketingOptIn: true,
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        loyaltyPoints: true,
      },
    });

    for (const user of milestoneUsers) {
      const couponCode = `LOYAL-${user.id.substring(0, 6).toUpperCase()}`;

      await prisma.coupon.upsert({
        where: { code: couponCode },
        update: {},
        create: {
          code: couponCode,
          type: 'FIXED',
          value: 250,
          usageLimit: 1,
          startsAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
      });

      await queueService.enqueue('SEND_EMAIL', {
        to: user.email,
        subject: "You've reached 1,000 points! Here's a reward",
        html: `<h2>Congratulations, ${user.name}!</h2><p>You've earned 1,000 loyalty points! Enjoy ₹250 off your next order with code: <strong>${couponCode}</strong></p><p>Valid for 30 days.</p>`,
      });

      notificationService
        .create(
          user.id,
          null,
          'LOYALTY_POINTS_EARNED' as any,
          'Loyalty Milestone Reached!',
          `You've reached 1,000 points! Use code ${couponCode} for ₹250 off.`,
          'IN_APP',
          { couponCode }
        )
        .catch(() => {});
    }

    logger.info({ count: milestoneUsers.length }, 'Loyalty milestone rewards processed');
    return { processed: milestoneUsers.length };
  }
}

export const automationService = new AutomationService();
