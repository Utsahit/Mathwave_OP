import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

const CONTACT_SELECT = {
  id: true,
  name: true,
  email: true,
  subject: true,
  message: true,
  isRead: true,
  createdAt: true,
  updatedAt: true,
  isDeleted: true,
  deletedAt: true,
} satisfies Prisma.ContactMessageSelect;

const SUBSCRIBER_SELECT = {
  id: true,
  email: true,
  isActive: true,
  subscribedAt: true,
  unsubscribedAt: true,
} satisfies Prisma.NewsletterSubscriberSelect;

export class ContactRepository {
  // ── ContactMessage CRUD ─────────────────────────────────────────────────────

  async createContactMessage(data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }) {
    return prisma.contactMessage.create({
      data,
      select: CONTACT_SELECT,
    });
  }

  async findRecentMessage(email: string, subject: string, message: string) {
    // Find duplicate in last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    return prisma.contactMessage.findFirst({
      where: {
        email,
        subject,
        message,
        createdAt: { gte: tenMinutesAgo },
        isDeleted: false,
      },
      select: { id: true },
    });
  }

  async findRecentByEmail(email: string, windowMs: number) {
    const threshold = new Date(Date.now() - windowMs);
    return prisma.contactMessage.findFirst({
      where: {
        email,
        createdAt: { gte: threshold },
        isDeleted: false,
      },
      select: { id: true },
    });
  }

  async listContactMessages(filters: {
    isRead?: boolean;
    search?: string;
    page: number;
    limit: number;
    sortBy: 'createdAt' | 'email';
    sortOrder: 'asc' | 'desc';
    branchIds?: string[];
  }) {
    const where: Prisma.ContactMessageWhereInput = { isDeleted: false };

    if (filters.branchIds) {
      where.branchId = { in: filters.branchIds };
    }

    if (filters.isRead !== undefined) {
      where.isRead = filters.isRead;
    }

    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { subject: { contains: filters.search, mode: 'insensitive' } },
        { name: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      prisma.contactMessage.findMany({
        where,
        select: CONTACT_SELECT,
        orderBy: { [filters.sortBy]: filters.sortOrder },
        skip,
        take: filters.limit,
      }),
      prisma.contactMessage.count({ where }),
    ]);

    return { items, total };
  }

  async getContactMessage(id: string) {
    return prisma.contactMessage.findFirst({
      where: { id, isDeleted: false },
      select: CONTACT_SELECT,
    });
  }

  async updateReadStatus(id: string, isRead: boolean) {
    return prisma.contactMessage.update({
      where: { id },
      data: { isRead },
      select: CONTACT_SELECT,
    });
  }

  async softDeleteContactMessage(id: string) {
    return prisma.contactMessage.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
      select: CONTACT_SELECT,
    });
  }

  async getContactStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalMessages, unreadMessages, messagesToday] = await Promise.all([
      prisma.contactMessage.count({ where: { isDeleted: false } }),
      prisma.contactMessage.count({ where: { isRead: false, isDeleted: false } }),
      prisma.contactMessage.count({
        where: {
          createdAt: { gte: todayStart },
          isDeleted: false,
        },
      }),
    ]);

    return { totalMessages, unreadMessages, messagesToday };
  }

  // ── NewsletterSubscriber CRUD ───────────────────────────────────────────────

  async upsertSubscriber(email: string) {
    // If exists and inactive, reactivate. If not exists, create.
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email },
      select: { id: true, isActive: true },
    });

    if (existing) {
      if (!existing.isActive) {
        return prisma.newsletterSubscriber.update({
          where: { email },
          data: {
            isActive: true,
            subscribedAt: new Date(),
            unsubscribedAt: null,
          },
          select: SUBSCRIBER_SELECT,
        });
      }
      return prisma.newsletterSubscriber.findUnique({
        where: { email },
        select: SUBSCRIBER_SELECT,
      });
    }

    return prisma.newsletterSubscriber.create({
      data: {
        email,
        isActive: true,
      },
      select: SUBSCRIBER_SELECT,
    });
  }

  async findSubscriberByEmail(email: string) {
    return prisma.newsletterSubscriber.findUnique({
      where: { email },
      select: SUBSCRIBER_SELECT,
    });
  }

  async unsubscribe(email: string) {
    return prisma.newsletterSubscriber.update({
      where: { email },
      data: {
        isActive: false,
        unsubscribedAt: new Date(),
      },
      select: SUBSCRIBER_SELECT,
    });
  }

  async listSubscribers(filters: {
    isActive?: boolean;
    search?: string;
    page: number;
    limit: number;
  }) {
    const where: Prisma.NewsletterSubscriberWhereInput = {};

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.search) {
      where.email = { contains: filters.search, mode: 'insensitive' };
    }

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      prisma.newsletterSubscriber.findMany({
        where,
        select: SUBSCRIBER_SELECT,
        orderBy: { subscribedAt: 'desc' },
        skip,
        take: filters.limit,
      }),
      prisma.newsletterSubscriber.count({ where }),
    ]);

    return { items, total };
  }

  async listAllSubscribersForExport() {
    return prisma.newsletterSubscriber.findMany({
      select: SUBSCRIBER_SELECT,
      orderBy: { subscribedAt: 'desc' },
    });
  }

  async deleteSubscriber(id: string) {
    return prisma.newsletterSubscriber.delete({
      where: { id },
      select: SUBSCRIBER_SELECT,
    });
  }

  async getNewsletterStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [activeSubscribers, inactiveSubscribers, subscriptionsToday] =
      await Promise.all([
        prisma.newsletterSubscriber.count({ where: { isActive: true } }),
        prisma.newsletterSubscriber.count({ where: { isActive: false } }),
        prisma.newsletterSubscriber.count({
          where: {
            subscribedAt: { gte: todayStart },
            isActive: true,
          },
        }),
      ]);

    return { activeSubscribers, inactiveSubscribers, subscriptionsToday };
  }
}

export const contactRepository = new ContactRepository();
