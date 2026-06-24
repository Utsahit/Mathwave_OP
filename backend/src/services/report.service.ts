import { prisma } from '../config/prisma';
import { getRedisClient } from '../config/redis';
import { queueService } from './queue.service';
import { OrderStatus } from '@prisma/client';

const STATS_TTL = 300;

async function getCached<T>(key: string): Promise<T | null> {
  try {
    const val = await getRedisClient().get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
}

async function setCache(key: string, data: unknown): Promise<void> {
  try {
    await getRedisClient().set(key, JSON.stringify(data), 'EX', STATS_TTL);
  } catch {
    /* silent */
  }
}

export class ReportService {
  async listScheduledReports() {
    const cacheKey = 'reports:list';
    const cached = await getCached(cacheKey);
    if (cached) return cached;

    const reports = await prisma.scheduledReport.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        frequency: true,
        isActive: true,
        lastSentAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    await setCache(cacheKey, reports);
    return reports;
  }

  async createScheduledReport(data: {
    name: string;
    email: string;
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  }) {
    const report = await prisma.scheduledReport.create({
      data: { name: data.name, email: data.email, frequency: data.frequency },
      select: {
        id: true,
        name: true,
        email: true,
        frequency: true,
        isActive: true,
        createdAt: true,
      },
    });
    const redis = getRedisClient();
    await redis.del('reports:list');
    return report;
  }

  async deleteScheduledReport(id: string) {
    await prisma.scheduledReport.delete({ where: { id } });
    const redis = getRedisClient();
    await redis.del('reports:list');
  }

  async exportCsv(type: 'revenue' | 'orders' | 'customers' | 'inventory' | 'branches') {
    const paidStatuses: OrderStatus[] = [
      'CONFIRMED',
      'PREPARING',
      'READY',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ];
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    let rows: Record<string, unknown>[] = [];

    switch (type) {
      case 'revenue': {
        const daily = await prisma.order.groupBy({
          by: ['createdAt'],
          where: { status: { in: paidStatuses }, createdAt: { gte: monthStart } },
          _sum: { finalAmount: true },
          _count: { id: true },
        });
        const dayMap = new Map<string, { revenue: number; orders: number }>();
        for (const r of daily) {
          const day = r.createdAt.toISOString().slice(0, 10);
          const e = dayMap.get(day) || { revenue: 0, orders: 0 };
          e.revenue += Number(r._sum.finalAmount || 0);
          e.orders += r._count.id;
          dayMap.set(day, e);
        }
        rows = Array.from(dayMap.entries()).map(([date, d]) => ({
          Date: date,
          Revenue: d.revenue,
          Orders: d.orders,
        }));
        break;
      }
      case 'orders': {
        const orders = await prisma.order.findMany({
          where: { createdAt: { gte: monthStart } },
          select: {
            orderNumber: true,
            finalAmount: true,
            status: true,
            createdAt: true,
            branchId: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1000,
        });
        rows = orders.map((o) => ({
          Order: o.orderNumber,
          Amount: Number(o.finalAmount || 0),
          Status: o.status,
          Date: o.createdAt.toISOString().slice(0, 10),
          Branch: o.branchId || '',
        }));
        break;
      }
      case 'customers': {
        const customers = await prisma.user.findMany({
          where: { isDeleted: false },
          select: {
            name: true,
            email: true,
            loyaltyPoints: true,
            createdAt: true,
            _count: { select: { orders: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 1000,
        });
        rows = customers.map((c) => ({
          Name: c.name,
          Email: c.email,
          Orders: c._count.orders,
          LoyaltyPoints: c.loyaltyPoints,
          Joined: c.createdAt.toISOString().slice(0, 10),
        }));
        break;
      }
      case 'inventory': {
        const ingredients = await prisma.ingredient.findMany({
          select: { name: true, currentStock: true, unit: true, minimumStock: true },
          orderBy: { name: 'asc' },
        });
        rows = ingredients.map((i) => ({
          Ingredient: i.name,
          Stock: i.currentStock,
          Unit: i.unit,
          MinStock: i.minimumStock,
        }));
        break;
      }
      case 'branches': {
        const branches = await prisma.branch.findMany({
          select: { name: true, city: true, isActive: true, createdAt: true },
          orderBy: { name: 'asc' },
        });
        rows = branches.map((b) => ({
          Branch: b.name,
          City: b.city,
          Active: b.isActive ? 'Yes' : 'No',
          Created: b.createdAt.toISOString().slice(0, 10),
        }));
        break;
      }
    }

    if (rows.length === 0) return 'Date,Value\n';
    const headers = Object.keys(rows[0]).join(',');
    const csv = rows
      .map((r) =>
        Object.values(r)
          .map((v) => `"${v}"`)
          .join(',')
      )
      .join('\n');
    return `${headers}\n${csv}`;
  }

  async queuePdfExport(type: string) {
    const job = await queueService.enqueue('pdf_export', {
      type,
      requestedAt: new Date().toISOString(),
    });
    return job;
  }
}

export const reportService = new ReportService();
