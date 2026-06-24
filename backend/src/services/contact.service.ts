import { prisma } from '../config/prisma';
import { getRedisClient } from '../config/redis';
import { contactRepository } from '../repositories/contact.repository';
import { mailService } from './mail.service';
import { AppError } from '../utils/app-error';
import { logger } from '../config/logger';
import { notificationService } from './notification.service';
import { auditService } from './audit.service';

// ── Configuration Constants ──────────────────────────────────────────────────
const IP_RATE_LIMIT_WINDOW_SEC = 3600; // 1 hour
const IP_RATE_LIMIT_MAX = 3;

const EMAIL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const STATS_CACHE_TTL = 3600; // 1 hour

const PROFANITY_WORDS = ['crap', 'shit', 'fuck', 'ass', 'bitch', 'spam', 'scam', 'fake'];

function hasProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  return PROFANITY_WORDS.some((word) => lower.includes(word));
}

// ── Cache helpers ─────────────────────────────────────────────────────────────
async function getCachedStats<T>(key: string): Promise<T | null> {
  try {
    const val = await getRedisClient().get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
}

async function setCachedStats(key: string, data: unknown): Promise<void> {
  try {
    await getRedisClient().set(key, JSON.stringify(data), 'EX', STATS_CACHE_TTL);
  } catch {
    // Silent fail
  }
}

async function invalidateExactKey(key: string): Promise<void> {
  try {
    await getRedisClient().del(key);
  } catch {
    // Silent fail
  }
}

export class ContactService {
  // ── Contact Inquiries ──────────────────────────────────────────────────────

  async submitContactMessage(
    data: {
      name: string;
      email: string;
      subject: string;
      message: string;
    },
    clientIp: string
  ) {
    // 1. IP Rate Limiting via Redis
    const ipKey = `contact:rate:ip:${clientIp}`;
    try {
      const redis = getRedisClient();
      const count = await redis.incr(ipKey);
      if (count === 1) {
        await redis.expire(ipKey, IP_RATE_LIMIT_WINDOW_SEC);
      }
      if (count > IP_RATE_LIMIT_MAX) {
        throw new AppError(
          'Too many message submissions. Please try again in an hour.',
          429,
          'RATE_LIMITED'
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.warn(
        { err },
        'Redis contact IP rate limit check failed — bypassing limit check.'
      );
    }

    // 2. Email Cooldown (1 submission per 5 minutes per email)
    const recentByEmail = await contactRepository.findRecentByEmail(
      data.email,
      EMAIL_COOLDOWN_MS
    );
    if (recentByEmail) {
      throw new AppError(
        'A message from this email was submitted recently. Please wait 5 minutes before trying again.',
        429,
        'EMAIL_COOLDOWN'
      );
    }

    // 3. Duplicate Message Detection (same email, subject, message in last 10 minutes)
    const duplicate = await contactRepository.findRecentMessage(
      data.email,
      data.subject,
      data.message
    );
    if (duplicate) {
      throw new AppError(
        'Duplicate message detected. You have already sent this message recently.',
        409,
        'DUPLICATE_MESSAGE'
      );
    }

    // 4. Basic Profanity Filter
    const textToCheck = `${data.subject} ${data.message}`;
    if (hasProfanity(textToCheck)) {
      throw new AppError(
        'Your message contains inappropriate language. Please revise and resubmit.',
        422,
        'PROFANITY_DETECTED'
      );
    }

    // 5. Create message
    const msg = await contactRepository.createContactMessage(data);

    // 6. Send in-app notification to admin users
    const adminUsers = await prisma.user.findMany({
      where: { role: { name: 'ADMIN' } },
      select: { id: true },
    });
    for (const admin of adminUsers) {
      notificationService
        .create(
          admin.id,
          null,
          'CONTACT_RECEIVED',
          'New Contact Message',
          `Message from ${data.name}: ${data.subject}`,
          'IN_APP',
          { contactId: msg.id }
        )
        .catch(() => {});
    }
    auditService
      .logCreate(null, 'ContactMessage', msg.id, {
        name: data.name,
        email: data.email,
        subject: data.subject,
      })
      .catch(() => {});

    // 7. Invalidate Stats Cache (exact key, no wildcards)
    await invalidateExactKey('contact:stats');

    // 8. Send notification email to admin asynchronously (silent fail)
    mailService.sendContactNotificationToAdmin(data).catch(() => {});

    return msg;
  }

  async listMessages(filters: {
    isRead?: boolean;
    search?: string;
    page: number;
    limit: number;
    sortBy: 'createdAt' | 'email';
    sortOrder: 'asc' | 'desc';
    branchIds?: string[];
  }) {
    return contactRepository.listContactMessages(filters);
  }

  async getMessage(id: string) {
    const msg = await contactRepository.getContactMessage(id);
    if (!msg) {
      throw new AppError('Contact message not found.', 404, 'NOT_FOUND');
    }
    return msg;
  }

  async markRead(id: string, isRead: boolean) {
    // Verify it exists first
    await this.getMessage(id);
    const updated = await contactRepository.updateReadStatus(id, isRead);
    await invalidateExactKey('contact:stats');
    return updated;
  }

  async softDeleteMessage(id: string) {
    // Verify it exists first
    await this.getMessage(id);
    const deleted = await contactRepository.softDeleteContactMessage(id);
    await invalidateExactKey('contact:stats');
    return deleted;
  }

  async getContactStats() {
    const cacheKey = 'contact:stats';
    const cached = await getCachedStats<{
      totalMessages: number;
      unreadMessages: number;
      messagesToday: number;
    }>(cacheKey);
    if (cached) return cached;

    const stats = await contactRepository.getContactStats();
    await setCachedStats(cacheKey, stats);
    return stats;
  }

  // ── Newsletter Subscriptions ──────────────────────────────────────────────

  async subscribeNewsletter(email: string) {
    // Check if subscriber exists
    const existing = await contactRepository.findSubscriberByEmail(email);
    if (existing && existing.isActive) {
      throw new AppError(
        'This email is already subscribed to our newsletter.',
        409,
        'DUPLICATE_SUBSCRIPTION'
      );
    }

    const sub = await contactRepository.upsertSubscriber(email);
    await invalidateExactKey('newsletter:stats');

    // Send Welcome Email (silent fail)
    mailService.sendNewsletterWelcome(email).catch(() => {});

    return sub;
  }

  async unsubscribeNewsletter(email: string) {
    const existing = await contactRepository.findSubscriberByEmail(email);
    if (!existing || !existing.isActive) {
      throw new AppError(
        'This email address is not currently subscribed to our newsletter.',
        400,
        'NOT_SUBSCRIBED'
      );
    }

    const unsub = await contactRepository.unsubscribe(email);
    await invalidateExactKey('newsletter:stats');

    // Send Unsubscribe Email (silent fail)
    mailService.sendNewsletterUnsubscribe(email).catch(() => {});

    return unsub;
  }

  async listSubscribers(filters: {
    isActive?: boolean;
    search?: string;
    page: number;
    limit: number;
  }) {
    return contactRepository.listSubscribers(filters);
  }

  async getSubscribersExport(format?: string) {
    const list = await contactRepository.listAllSubscribersForExport();

    if (format === 'csv') {
      const headers = 'email,subscribedAt,isActive\n';
      const rows = list
        .map(
          (sub) => `"${sub.email}","${sub.subscribedAt.toISOString()}",${sub.isActive}`
        )
        .join('\n');
      return headers + rows;
    }

    return list;
  }

  async deleteSubscriber(id: string) {
    try {
      const deleted = await contactRepository.deleteSubscriber(id);
      await invalidateExactKey('newsletter:stats');
      return deleted;
    } catch {
      throw new AppError('Subscriber not found.', 404, 'NOT_FOUND');
    }
  }

  async getNewsletterStats() {
    const cacheKey = 'newsletter:stats';
    const cached = await getCachedStats<{
      activeSubscribers: number;
      inactiveSubscribers: number;
      subscriptionsToday: number;
    }>(cacheKey);
    if (cached) return cached;

    const stats = await contactRepository.getNewsletterStats();
    await setCachedStats(cacheKey, stats);
    return stats;
  }
}

export const contactService = new ContactService();
