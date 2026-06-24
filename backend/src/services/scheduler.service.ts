import { prisma } from '../config/prisma';
import { queueService } from './queue.service';
import { logger } from '../config/logger';
import { OrderStatus } from '@prisma/client';
import { automationService } from './automation.service';
import { segmentationService } from './segmentation.service';

export class SchedulerService {
  private intervals: ReturnType<typeof setInterval>[] = [];
  private started = false;

  start() {
    if (this.started) {
      logger.warn('Scheduler already started — skipping duplicate start().');
      return;
    }
    this.started = true;
    this.everyFiveMinutes();
    this.everyHour();
    this.everyDay();
    this.everyWeek();
    this.everyMonth();
    logger.info('Scheduler started — all cron jobs registered.');
  }

  stop() {
    this.started = false;
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];
    logger.info('Scheduler stopped — all cron jobs cleared.');
  }

  private everyFiveMinutes() {
    const id = setInterval(
      async () => {
        try {
          await this.checkLowStock();
        } catch (err) {
          logger.error({ err }, '5-min scheduler: checkLowStock failed');
        }
      },
      5 * 60 * 1000
    );
    this.intervals.push(id);
  }

  private everyHour() {
    const id = setInterval(
      async () => {
        try {
          await this.retryFailedNotifications();
          await this.processPendingJobs();
          await this.scanAbandonedCarts();
        } catch (err) {
          logger.error({ err }, 'Hourly scheduler: job processing failed');
        }
      },
      60 * 60 * 1000
    );
    this.intervals.push(id);
  }

  private everyDay() {
    const id = setInterval(
      async () => {
        try {
          await this.generateDailyAnalytics();
          await this.cleanExpiredGuestCarts();
          await this.processBirthdayCampaigns();
          await this.processWinBackCampaigns();
          await this.processLoyaltyMilestones();
          await this.recalculateSegments();
        } catch (err) {
          logger.error({ err }, 'Daily scheduler: analytics/cleanup failed');
        }
      },
      24 * 60 * 60 * 1000
    );
    this.intervals.push(id);
  }

  private async checkLowStock() {
    await queueService.enqueue('LOW_STOCK_ALERT', {
      triggeredAt: new Date().toISOString(),
    });
    await queueService.processNextPending();
  }

  private async retryFailedNotifications() {
    const failedJobs = await prisma.jobQueue.findMany({
      where: { status: 'FAILED', attempts: { lt: 3 } },
      orderBy: { createdAt: 'asc' },
      take: 10,
      select: { id: true },
    });

    for (const job of failedJobs) {
      await queueService.retryFailedJob(job.id);
    }
  }

  private async processPendingJobs() {
    await queueService.processNextPending();
  }

  private async generateDailyAnalytics() {
    await queueService.enqueue('DAILY_ANALYTICS', {
      triggeredAt: new Date().toISOString(),
    });
    await this.snapshotKpis();
    await queueService.processNextPending();
  }

  private async snapshotKpis() {
    const paidStatuses: OrderStatus[] = [
      'CONFIRMED',
      'PREPARING',
      'READY',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const [revenueAgg, orderCount, reservationCount, customerCount, loyaltyMembers] =
      await Promise.all([
        prisma.order.aggregate({
          _sum: { finalAmount: true },
          where: {
            status: { in: paidStatuses },
            createdAt: { gte: today, lte: todayEnd },
          },
        }),
        prisma.order.count({ where: { createdAt: { gte: today, lte: todayEnd } } }),
        prisma.reservation.count({ where: { createdAt: { gte: today, lte: todayEnd } } }),
        prisma.user.count({
          where: { isDeleted: false, createdAt: { gte: today, lte: todayEnd } },
        }),
        prisma.user.count({ where: { loyaltyPoints: { gt: 0 } } }),
      ]);

    const revenue = revenueAgg._sum.finalAmount ?? 0;
    const avgOrderValue = orderCount > 0 ? Number(revenue) / orderCount : 0;

    await prisma.kpiSnapshot.create({
      data: {
        snapshotDate: today,
        revenue,
        orders: orderCount,
        reservations: reservationCount,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        customers: customerCount,
        loyaltyMembers,
      },
    });
    logger.info({ revenue, orders: orderCount }, 'KPI snapshot saved');
  }

  private async cleanExpiredGuestCarts() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const expiredCarts = await prisma.cart.findMany({
      where: {
        userId: null,
        createdAt: { lt: thirtyDaysAgo },
      },
      select: { id: true },
    });

    const ids = expiredCarts.map((c) => c.id);
    if (ids.length === 0) return;

    await prisma.cartItem.deleteMany({ where: { cartId: { in: ids } } });
    await prisma.cart.deleteMany({ where: { id: { in: ids } } });
    logger.info({ count: ids.length }, 'Expired guest carts cleaned up');
  }

  private everyWeek() {
    const id = setInterval(
      async () => {
        try {
          await this.sendWeeklyReports();
        } catch (err) {
          logger.error({ err }, 'Weekly scheduler: report sending failed');
        }
      },
      7 * 24 * 60 * 60 * 1000
    );
    this.intervals.push(id);
  }

  private everyMonth() {
    const id = setInterval(
      async () => {
        try {
          await this.sendMonthlyReports();
        } catch (err) {
          logger.error({ err }, 'Monthly scheduler: report sending failed');
        }
      },
      30 * 24 * 60 * 60 * 1000
    );
    this.intervals.push(id);
  }

  private async sendWeeklyReports() {
    const reports = await prisma.scheduledReport.findMany({
      where: { isActive: true, frequency: 'WEEKLY' },
    });
    for (const report of reports) {
      await queueService.enqueue('SEND_REPORT_EMAIL', {
        reportId: report.id,
        email: report.email,
        name: report.name,
        frequency: 'WEEKLY',
      });
      await prisma.scheduledReport.update({
        where: { id: report.id },
        data: { lastSentAt: new Date() },
      });
    }
    logger.info({ count: reports.length }, 'Weekly reports queued');
  }

  private async sendMonthlyReports() {
    const reports = await prisma.scheduledReport.findMany({
      where: { isActive: true, frequency: 'MONTHLY' },
    });
    for (const report of reports) {
      await queueService.enqueue('SEND_REPORT_EMAIL', {
        reportId: report.id,
        email: report.email,
        name: report.name,
        frequency: 'MONTHLY',
      });
      await prisma.scheduledReport.update({
        where: { id: report.id },
        data: { lastSentAt: new Date() },
      });
    }
    logger.info({ count: reports.length }, 'Monthly reports queued');
  }

  private async scanAbandonedCarts() {
    try {
      const result = await automationService.processAbandonedCarts();
      if (result.processed > 0) {
        logger.info({ processed: result.processed }, 'Abandoned cart reminders sent');
      }
    } catch (err) {
      logger.error({ err }, 'Abandoned cart scan failed');
    }
  }

  private async processBirthdayCampaigns() {
    try {
      const result = await automationService.processBirthdayRewards();
      if (result.processed > 0) {
        logger.info({ processed: result.processed }, 'Birthday rewards processed');
      }
    } catch (err) {
      logger.error({ err }, 'Birthday campaign processing failed');
    }
  }

  private async processWinBackCampaigns() {
    try {
      const result = await automationService.processWinBackCampaigns();
      if (result.processed > 0) {
        logger.info({ processed: result.processed }, 'Win-back campaigns processed');
      }
    } catch (err) {
      logger.error({ err }, 'Win-back campaign processing failed');
    }
  }

  private async processLoyaltyMilestones() {
    try {
      const result = await automationService.processLoyaltyMilestones();
      if (result.processed > 0) {
        logger.info({ processed: result.processed }, 'Loyalty milestones processed');
      }
    } catch (err) {
      logger.error({ err }, 'Loyalty milestone processing failed');
    }
  }

  private async recalculateSegments() {
    try {
      const result = await segmentationService.recalculateAll();
      logger.info({ assigned: result.assigned }, 'Daily segment recalculation complete');
    } catch (err) {
      logger.error({ err }, 'Segment recalculation failed');
    }
  }

  async runLowStockCheckNow() {
    await this.checkLowStock();
  }

  async runGuestCartCleanupNow() {
    await this.cleanExpiredGuestCarts();
  }

  async runAnalyticsGenerationNow() {
    await this.generateDailyAnalytics();
  }
}

export const schedulerService = new SchedulerService();
