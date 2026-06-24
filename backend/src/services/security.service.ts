import { prisma } from '../config/prisma';
import { getRedisClient } from '../config/redis';

interface SecurityDashboard {
  failedLoginsToday: number;
  lockedAccounts: number;
  activeSessions: number;
  rbacViolations: number;
  rateLimitHits: number;
  failedPayments: number;
  totalUsers: number;
  totalRoles: number;
  totalPermissions: number;
  recentViolations: Array<{
    id: string;
    action: string;
    entityType: string;
    userId: string | null;
    createdAt: Date;
  }>;
}

export class SecurityService {
  async getDashboard(): Promise<SecurityDashboard> {
    const redis = getRedisClient();
    const cacheKey = 'security:dashboard';

    if (redis.status === 'ready') {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    let failedLoginsToday = 0;
    let lockedAccounts = 0;
    let rateLimitHits = 0;

    if (redis.status === 'ready') {
      try {
        const failedKeys = await redis.keys('auth:failed_attempts:*');
        failedLoginsToday = failedKeys.length;
      } catch {
        // Redis cluster may not support KEYS
      }

      try {
        const lockedKeys = await redis.keys('auth:locked:*');
        lockedAccounts = lockedKeys.length;
      } catch {
        // Redis cluster may not support KEYS
      }

      try {
        const rlKeys = await redis.keys('rl:*');
        rateLimitHits = rlKeys.length;
      } catch {
        // Redis cluster may not support KEYS
      }
    }

    const [
      activeSessions,
      rbacViolations,
      failedPayments,
      totalUsers,
      totalRoles,
      totalPermissions,
      recentViolations,
    ] = await Promise.all([
      prisma.userSession.count({ where: { expiresAt: { gt: new Date() } } }),
      prisma.auditLog.count({ where: { action: { contains: 'SECURITY' } } }),
      prisma.transaction.count({
        where: { status: 'FAILED', createdAt: { gte: startOfToday } },
      }),
      prisma.user.count({ where: { isDeleted: false } }),
      prisma.dbRole.count(),
      prisma.dbPermission.count(),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          entityType: true,
          userId: true,
          createdAt: true,
        },
      }),
    ]);

    const result: SecurityDashboard = {
      failedLoginsToday,
      lockedAccounts,
      activeSessions,
      rbacViolations,
      rateLimitHits,
      failedPayments,
      totalUsers,
      totalRoles,
      totalPermissions,
      recentViolations,
    };

    if (redis.status === 'ready') {
      await redis.set(cacheKey, JSON.stringify(result), 'EX', 120);
    }
    return result;
  }

  async invalidateDashboardCache() {
    const redis = getRedisClient();
    if (redis.status === 'ready') {
      await redis.del('security:dashboard');
    }
  }
}

export const securityService = new SecurityService();
