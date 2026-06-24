import { prisma } from '../config/prisma';
import { getRedisClient } from '../config/redis';
import { notificationService } from './notification.service';
import { logger } from '../config/logger';
import { Prisma, OrderStatus } from '@prisma/client';
import { env } from '../config/env';
import nodemailer from 'nodemailer';

const STATS_TTL = 300;

export class QueueService {
  async enqueue(type: string, payload: Record<string, unknown>) {
    const job = await prisma.jobQueue.create({
      data: {
        type,
        payload: payload as Prisma.JsonObject,
        status: 'PENDING',
      },
      select: { id: true, type: true, status: true, attempts: true, createdAt: true },
    });
    await this.invalidateStats();
    return job;
  }

  MAX_RETRIES = 10;

  async processJob(jobId: string) {
    const claimed = await prisma.jobQueue.updateMany({
      where: { id: jobId, status: 'PENDING' },
      data: { status: 'PROCESSING', attempts: { increment: 1 } },
    });
    if (claimed.count === 0) return null;

    const job = await prisma.jobQueue.findUnique({
      where: { id: jobId },
      select: { id: true, type: true, payload: true, attempts: true },
    });
    if (!job) return null;

    try {
      await this.executeJob(job.type, job.payload as Record<string, unknown>);
      const completed = await prisma.jobQueue.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', processedAt: new Date() },
        select: { id: true, type: true, status: true, attempts: true, processedAt: true },
      });
      await this.invalidateStats();
      return completed;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      const nextStatus = job.attempts >= this.MAX_RETRIES ? 'FAILED' : 'PENDING';
      const failed = await prisma.jobQueue.update({
        where: { id: jobId },
        data: { status: nextStatus, lastError: errMsg },
        select: { id: true, type: true, status: true, attempts: true, lastError: true },
      });
      logger.error(
        { jobId, type: job.type, error: errMsg, attempts: job.attempts },
        'Job processing failed'
      );
      await this.invalidateStats();
      return failed;
    }
  }

  async retryFailedJob(jobId: string) {
    const job = await prisma.jobQueue.findUnique({ where: { id: jobId } });
    if (!job || job.status !== 'FAILED') return null;

    const reset = await prisma.jobQueue.update({
      where: { id: jobId },
      data: { status: 'PENDING', lastError: null },
      select: { id: true, type: true, status: true, attempts: true },
    });
    await this.invalidateStats();
    return reset;
  }

  async list(page = 1, pageSize = 20, status?: string) {
    const skip = (page - 1) * pageSize;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.jobQueue.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          type: true,
          status: true,
          attempts: true,
          lastError: true,
          createdAt: true,
          processedAt: true,
        },
      }),
      prisma.jobQueue.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async getStats() {
    const cacheKey = 'jobs:stats';
    try {
      const cached = await getRedisClient().get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      // silent
    }

    const groups = await prisma.jobQueue.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0,
    };
    for (const g of groups) {
      stats[g.status.toLowerCase() as keyof typeof stats] = g._count.id;
      stats.total += g._count.id;
    }

    try {
      await getRedisClient().set(cacheKey, JSON.stringify(stats), 'EX', STATS_TTL);
    } catch {
      // silent
    }

    return stats;
  }

  private async executeJob(type: string, payload: Record<string, unknown>) {
    switch (type) {
      case 'SEND_EMAIL':
        await this.sendEmail(payload);
        break;
      case 'LOW_STOCK_ALERT':
        await this.sendLowStockAlert(payload);
        break;
      case 'DAILY_ANALYTICS':
        await this.sendDailyAnalytics(payload);
        break;
      case 'NEWSLETTER_SEND':
        await this.sendNewsletter(payload);
        break;
      case 'CAMPAIGN_DISPATCH':
        await this.dispatchCampaign(payload);
        break;
      default:
        logger.warn({ type }, 'Unknown job type');
    }
  }

  private async sendEmail(payload: Record<string, unknown>) {
    const { to, subject, html, notificationId } = payload as Record<string, string>;
    if (!to || !subject) return;

    try {
      const transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth:
          env.SMTP_USER && env.SMTP_PASS
            ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
            : undefined,
      });
      await transporter.sendMail({
        from: `"Elixir & Oak" <hello@elixirandoak.in>`,
        to,
        subject,
        html: html || subject,
      });
      if (notificationId) {
        await prisma.notification.update({
          where: { id: notificationId },
          data: { isSent: true, sentAt: new Date() },
        });
      }
      logger.info({ to, subject }, 'Queued email sent successfully');
    } catch (err) {
      logger.error({ err, to, subject }, 'Queued email send failed');
      throw err;
    }
  }

  private async sendLowStockAlert(_payload: Record<string, unknown>) {
    const lowStock: {
      id: string;
      name: string;
      currentStock: number;
      minimumStock: number;
    }[] = await prisma.$queryRaw`
        SELECT id, name, "currentStock" as "currentStock", "minimumStock" as "minimumStock"
        FROM "Ingredient"
        WHERE "currentStock" <= "minimumStock" AND "isActive" = true AND "isDeleted" = false
      `;

    const adminUsers = await prisma.user.findMany({
      where: { role: { name: 'ADMIN' } },
      select: { id: true },
    });

    for (const ingredient of lowStock) {
      for (const admin of adminUsers) {
        await notificationService.create(
          admin.id,
          null,
          'LOW_STOCK',
          'Low Stock Alert',
          `${ingredient.name} is low (${ingredient.currentStock}/${ingredient.minimumStock} ${ingredient.name})`,
          'IN_APP',
          {
            ingredientId: ingredient.id,
            currentStock: Number(ingredient.currentStock),
            minimumStock: Number(ingredient.minimumStock),
          }
        );
      }
    }
  }

  private async sendDailyAnalytics(_payload: Record<string, unknown>) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [ordersToday, revenueToday] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.aggregate({
        where: {
          createdAt: { gte: today },
          status: {
            in: [
              OrderStatus.CONFIRMED,
              OrderStatus.PREPARING,
              OrderStatus.READY,
              OrderStatus.OUT_FOR_DELIVERY,
              OrderStatus.DELIVERED,
            ],
          },
        },
        _sum: { finalAmount: true },
      }),
    ]);

    const adminUsers = await prisma.user.findMany({
      where: { role: { name: 'ADMIN' } },
      select: { id: true },
    });

    for (const admin of adminUsers) {
      await notificationService.create(
        admin.id,
        null,
        'SYSTEM',
        'Daily Analytics Summary',
        `Orders today: ${ordersToday} | Revenue today: ₹${Number(revenueToday._sum.finalAmount || 0)}`,
        'IN_APP'
      );
    }
  }

  private async sendNewsletter(payload: Record<string, unknown>) {
    const { subject, content } = payload as Record<string, string>;
    const subscribers = await prisma.newsletterSubscriber.findMany({
      where: { isActive: true },
      select: { email: true },
    });

    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    });

    for (const sub of subscribers) {
      try {
        await transporter.sendMail({
          from: `"Elixir & Oak" <hello@elixirandoak.in>`,
          to: sub.email,
          subject: subject || 'Elixir & Oak Newsletter',
          html: content || subject || '',
        });
      } catch (err) {
        logger.error({ err, email: sub.email }, 'Newsletter send failed for subscriber');
      }
    }
  }

  private async dispatchCampaign(payload: Record<string, unknown>) {
    const { campaignId, type, subject, content } = payload as Record<string, string>;
    if (!campaignId) return;

    try {
      if (type === 'EMAIL') {
        const customers = await prisma.user.findMany({
          where: { marketingOptIn: true, isDeleted: false, role: { name: 'CUSTOMER' } },
          select: { id: true, email: true, name: true },
        });

        const transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_PORT === 465,
          auth:
            env.SMTP_USER && env.SMTP_PASS
              ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
              : undefined,
        });

        for (const customer of customers) {
          try {
            const rendered = (content || '').replace(/{{name}}/g, customer.name);
            await transporter.sendMail({
              from: '"Elixir & Oak" <hello@elixirandoak.in>',
              to: customer.email,
              subject: subject || 'Elixir & Oak',
              html: rendered,
            });
            await prisma.campaignRecipient.create({
              data: {
                campaignId,
                userId: customer.id,
                email: customer.email,
                isDelivered: true,
                deliveredAt: new Date(),
              },
            });
          } catch {
            await prisma.campaignRecipient.create({
              data: {
                campaignId,
                userId: customer.id,
                email: customer.email,
                isDelivered: false,
              },
            });
          }
        }
      } else if (type === 'PUSH') {
        const tokens = await prisma.pushNotificationToken.findMany({
          where: { user: { marketingOptIn: true, isDeleted: false } },
          select: { userId: true, token: true },
        });
        for (const t of tokens) {
          try {
            logger.info(
              { userId: t.userId, token: t.token, subject, content },
              'Campaign push dispatched'
            );
            await prisma.campaignRecipient.create({
              data: {
                campaignId,
                userId: t.userId,
                isDelivered: true,
                deliveredAt: new Date(),
              },
            });
          } catch {
            await prisma.campaignRecipient.create({
              data: { campaignId, userId: t.userId, isDelivered: false },
            });
          }
        }
      } else if (type === 'WHATSAPP') {
        const customers = await prisma.user.findMany({
          where: { marketingOptIn: true, isDeleted: false, role: { name: 'CUSTOMER' } },
          select: { id: true, name: true },
        });
        for (const customer of customers) {
          const rendered = (content || '').replace(/{{name}}/g, customer.name);
          logger.info(
            { campaignId, userId: customer.id, message: rendered },
            'WhatsApp campaign message'
          );
          await prisma.campaignRecipient.create({
            data: {
              campaignId,
              userId: customer.id,
              isDelivered: true,
              deliveredAt: new Date(),
            },
          });
        }
      }

      await prisma.marketingCampaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      logger.info({ campaignId, type }, 'Campaign dispatch completed');
    } catch (err) {
      logger.error({ err, campaignId, type }, 'Campaign dispatch failed');
      throw err;
    }
  }

  private async invalidateStats() {
    try {
      await getRedisClient().del('jobs:stats');
    } catch {
      // silent
    }
  }

  async processNextPending() {
    const job = await prisma.jobQueue.findFirst({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (job) {
      return this.processJob(job.id);
    }
    return null;
  }
}

export const queueService = new QueueService();
