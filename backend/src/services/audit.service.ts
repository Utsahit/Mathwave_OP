import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

export class AuditService {
  async logCreate(
    userId: string | null,
    entityType: string,
    entityId: string,
    newValue: Record<string, unknown> | null = null
  ) {
    return prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE',
        entityType,
        entityId,
        newValue: (newValue ?? {}) as Prisma.JsonObject,
      },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        userId: true,
        createdAt: true,
      },
    });
  }

  async logUpdate(
    userId: string | null,
    entityType: string,
    entityId: string,
    oldValue: Record<string, unknown> | null,
    newValue: Record<string, unknown> | null
  ) {
    return prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entityType,
        entityId,
        oldValue: (oldValue ?? {}) as Prisma.JsonObject,
        newValue: (newValue ?? {}) as Prisma.JsonObject,
      },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        userId: true,
        createdAt: true,
      },
    });
  }

  async logDelete(
    userId: string | null,
    entityType: string,
    entityId: string,
    oldValue: Record<string, unknown> | null = null
  ) {
    return prisma.auditLog.create({
      data: {
        userId,
        action: 'DELETE',
        entityType,
        entityId,
        oldValue: (oldValue ?? {}) as Prisma.JsonObject,
      },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        userId: true,
        createdAt: true,
      },
    });
  }

  async logStatusChange(
    userId: string | null,
    entityType: string,
    entityId: string,
    oldStatus: string,
    newStatus: string
  ) {
    return prisma.auditLog.create({
      data: {
        userId,
        action: 'STATUS_CHANGE',
        entityType,
        entityId,
        oldValue: { status: oldStatus } as Prisma.JsonObject,
        newValue: { status: newStatus } as Prisma.JsonObject,
      },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        userId: true,
        createdAt: true,
      },
    });
  }

  async list(
    page = 1,
    pageSize = 20,
    filters?: { entityType?: string; userId?: string; action?: string }
  ) {
    const skip = (page - 1) * pageSize;
    const where: Record<string, unknown> = {};
    if (filters?.entityType) where.entityType = filters.entityType;
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.action) where.action = filters.action;

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          userId: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }
}

export const auditService = new AuditService();
