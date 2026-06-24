import { prisma } from '../config/prisma';
import { getRedisClient } from '../config/redis';
import { NotificationType, NotificationChannel, Prisma } from '@prisma/client';

const NOTIFICATIONS_TTL = 300;

type JsonValue = Record<string, unknown>;

export class NotificationService {
  async create(
    userId: string | null,
    email: string | null,
    type: NotificationType,
    title: string,
    message: string,
    channel: NotificationChannel = 'IN_APP',
    metadata?: JsonValue
  ) {
    if (channel === 'IN_APP' && userId) {
      const notification = await prisma.notification.create({
        data: {
          userId,
          type,
          title,
          message,
          channel,
          metadata: (metadata ?? {}) as Prisma.InputJsonValue,
        },
        select: {
          id: true,
          userId: true,
          type: true,
          title: true,
          message: true,
          channel: true,
          isRead: true,
          createdAt: true,
        },
      });
      await this.invalidateCache(userId);
      return notification;
    }
    if (channel === 'EMAIL' && email) {
      const notification = await prisma.notification.create({
        data: {
          email,
          type,
          title,
          message,
          channel,
          isSent: false,
          metadata: (metadata ?? {}) as Prisma.InputJsonValue,
        },
        select: {
          id: true,
          email: true,
          type: true,
          title: true,
          message: true,
          channel: true,
          isSent: true,
          createdAt: true,
        },
      });
      return notification;
    }
    return null;
  }

  async listNotifications(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          message: true,
          type: true,
          isRead: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({ where: { userId } }),
    ]);

    return { data, total };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const cacheKey = `notifications:unread:${userId}`;
    const cached = await this.getCached<number>(cacheKey);
    if (cached !== null) return cached;

    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });
    await this.setCache(cacheKey, count);
    return count;
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
    await this.invalidateCache(userId);
    return notification;
  }

  async markAllAsRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    await this.invalidateCache(userId);
    return result;
  }

  async getPreferences(userId: string) {
    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId },
      select: { orderUpdates: true, reservationUpdates: true, marketingEmails: true },
    });
    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: { userId },
        select: { orderUpdates: true, reservationUpdates: true, marketingEmails: true },
      });
    }
    return prefs;
  }

  async updatePreferences(
    userId: string,
    data: {
      orderUpdates?: boolean;
      reservationUpdates?: boolean;
      marketingEmails?: boolean;
    }
  ) {
    return prisma.notificationPreference.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
      select: { orderUpdates: true, reservationUpdates: true, marketingEmails: true },
    });
  }

  async sendBulkNotifications(
    userIds: string[],
    type: NotificationType,
    title: string,
    message: string,
    metadata?: JsonValue
  ) {
    const notifications = userIds.map((userId) => ({
      userId,
      type,
      title,
      message,
      channel: 'IN_APP' as NotificationChannel,
      metadata: (metadata ?? {}) as Prisma.InputJsonValue,
    }));
    await prisma.notification.createMany({
      data: notifications as Prisma.NotificationCreateManyInput[],
    });
    for (const userId of userIds) {
      await this.invalidateCache(userId);
    }
  }

  private async invalidateCache(userId: string) {
    try {
      const client = getRedisClient();
      await client.del(`notifications:${userId}`);
      await client.del(`notifications:unread:${userId}`);
    } catch {
      // silent
    }
  }

  private async getCached<T>(key: string): Promise<T | null> {
    try {
      const val = await getRedisClient().get(key);
      return val ? (JSON.parse(val) as T) : null;
    } catch {
      return null;
    }
  }

  private async setCache(key: string, data: unknown): Promise<void> {
    try {
      await getRedisClient().set(key, JSON.stringify(data), 'EX', NOTIFICATIONS_TTL);
    } catch {
      // silent
    }
  }
}

export const notificationService = new NotificationService();
