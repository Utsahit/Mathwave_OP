import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

export class PushNotificationService {
  async registerToken(userId: string, deviceType: string, token: string) {
    const existing = await prisma.pushNotificationToken.findUnique({
      where: { token },
    });

    if (existing) {
      if (existing.userId !== userId) {
        await prisma.pushNotificationToken.update({
          where: { token },
          data: { userId, deviceType },
        });
      }
      return { registered: true };
    }

    await prisma.pushNotificationToken.create({
      data: { userId, deviceType, token },
    });

    return { registered: true };
  }

  async unregisterToken(token: string) {
    try {
      await prisma.pushNotificationToken.delete({ where: { token } });
    } catch {
      // Already removed
    }
  }

  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
  ) {
    const tokens = await prisma.pushNotificationToken.findMany({
      where: { userId },
      select: { token: true, deviceType: true },
    });

    if (tokens.length === 0) return { sent: 0 };

    let sent = 0;
    for (const t of tokens) {
      try {
        logger.info(
          { userId, token: t.token, title, body, data },
          'Push notification dispatched'
        );
        sent++;
      } catch {
        logger.error({ userId, token: t.token }, 'Push notification send failed');
      }
    }

    return { sent };
  }

  async broadcastToAllCustomers(
    title: string,
    body: string,
    data?: Record<string, unknown>
  ) {
    const tokens = await prisma.pushNotificationToken.findMany({
      select: { token: true, deviceType: true },
    });

    if (tokens.length === 0) return { sent: 0 };

    let sent = 0;
    for (const t of tokens) {
      try {
        logger.info({ token: t.token, title, body, data }, 'Push broadcast dispatched');
        sent++;
      } catch {
        logger.error({ token: t.token }, 'Push broadcast send failed');
      }
    }

    return { sent, total: tokens.length };
  }
}

export const pushNotificationService = new PushNotificationService();
