import { prisma } from '../config/prisma';
import { getRedisClient } from '../config/redis';
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
    // silent
  }
}

export class AnalyticsService {
  async getDashboard() {
    const cacheKey = 'analytics:dashboard';
    const cached = await getCached<{
      totalOrders: number;
      ordersToday: number;
      revenueToday: number;
      revenueThisMonth: number;
      averageOrderValue: number;
      topSellingItems: { menuItemId: string; name: string; totalSold: number }[];
      lowStockCount: number;
      pendingReservations: number;
      activeKitchenTickets: number;
    }>(cacheKey);
    if (cached) return cached;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      ordersToday,
      revenueTodayAgg,
      revenueMonthAgg,
      avgAgg,
      topSellingRaw,
      lowStockCount,
      pendingReservations,
      activeKitchenTickets,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.aggregate({
        where: {
          createdAt: { gte: todayStart },
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
      prisma.order.aggregate({
        where: {
          createdAt: { gte: monthStart },
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
      prisma.order.aggregate({
        where: { status: OrderStatus.DELIVERED },
        _avg: { finalAmount: true },
      }),
      prisma.orderItem.groupBy({
        by: ['menuItemId'],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
      prisma.ingredient.count({
        where: {
          currentStock: { lte: 0 },
        },
      }),
      prisma.reservation.count({
        where: { status: 'PENDING' },
      }),
      prisma.kitchenTicket.count({
        where: {
          startedAt: { not: null },
          completedAt: null,
        },
      }),
    ]);

    const menuItemIds = topSellingRaw.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, name: true },
    });
    const menuItemMap = new Map(menuItems.map((m) => [m.id, m.name]));

    const topSellingItems = topSellingRaw.map((item) => ({
      menuItemId: item.menuItemId,
      name: menuItemMap.get(item.menuItemId) || 'Unknown',
      totalSold: item._sum.quantity || 0,
    }));

    const dashboard = {
      totalOrders,
      ordersToday,
      revenueToday: revenueTodayAgg._sum.finalAmount || 0,
      revenueThisMonth: revenueMonthAgg._sum.finalAmount || 0,
      averageOrderValue: avgAgg._avg.finalAmount || 0,
      topSellingItems,
      lowStockCount,
      pendingReservations,
      activeKitchenTickets,
    };

    await setCache(cacheKey, dashboard);
    return dashboard;
  }

  async getOrderAnalytics() {
    const cacheKey = 'analytics:orders';
    const cached = await getCached<{
      total: number;
      pending: number;
      confirmed: number;
      preparing: number;
      ready: number;
      outForDelivery: number;
      delivered: number;
      cancelled: number;
    }>(cacheKey);
    if (cached) return cached;

    const counts = await prisma.order.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const statusMap: Record<string, number> = {};
    for (const c of counts) {
      statusMap[c.status] = c._count.id;
    }

    const analytics = {
      total: Object.values(statusMap).reduce((a, b) => a + b, 0),
      pending: statusMap[OrderStatus.PENDING] || 0,
      confirmed: statusMap[OrderStatus.CONFIRMED] || 0,
      preparing: statusMap[OrderStatus.PREPARING] || 0,
      ready: statusMap[OrderStatus.READY] || 0,
      outForDelivery: statusMap[OrderStatus.OUT_FOR_DELIVERY] || 0,
      delivered: statusMap[OrderStatus.DELIVERED] || 0,
      cancelled: statusMap[OrderStatus.CANCELLED] || 0,
    };

    await setCache(cacheKey, analytics);
    return analytics;
  }

  async getRevenueAnalytics() {
    const cacheKey = 'analytics:revenue';
    const cached = await getCached<{
      totalRevenue: number;
      averageOrderValue: number;
      totalOrders: number;
    }>(cacheKey);
    if (cached) return cached;

    const [revenueAgg, avgAgg] = await Promise.all([
      prisma.order.aggregate({
        where: {
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
      prisma.order.aggregate({
        where: { status: OrderStatus.DELIVERED },
        _avg: { finalAmount: true },
        _count: { id: true },
      }),
    ]);

    const analytics = {
      totalRevenue: revenueAgg._sum.finalAmount || 0,
      averageOrderValue: avgAgg._avg.finalAmount || 0,
      totalOrders: avgAgg._count.id,
    };

    await setCache(cacheKey, analytics);
    return analytics;
  }

  async getInventoryAnalytics() {
    const cacheKey = 'analytics:inventory';
    const cached = await getCached<{
      lowStockCount: number;
      totalIngredients: number;
      totalSuppliers: number;
      pendingPurchaseOrders: number;
    }>(cacheKey);
    if (cached) return cached;

    const [lowStockCount, totalIngredients, totalSuppliers, pendingPO] =
      await Promise.all([
        prisma.ingredient.count({ where: { currentStock: { lte: 0 } } }),
        prisma.ingredient.count(),
        prisma.supplier.count({ where: { isActive: true } }),
        prisma.purchaseOrder.count({ where: { status: 'SENT' } }),
      ]);

    const analytics = {
      lowStockCount,
      totalIngredients,
      totalSuppliers,
      pendingPurchaseOrders: pendingPO,
    };

    await setCache(cacheKey, analytics);
    return analytics;
  }

  async getLoyaltyAnalytics() {
    const cacheKey = 'analytics:loyalty';
    const cached = await getCached<{
      totalMembers: number;
      pointsIssued: number;
      pointsRedeemed: number;
      totalCoupons: number;
      couponRedemptionRate: number;
      giftCardUtilization: number;
      referralConversionRate: number;
    }>(cacheKey);
    if (cached) return cached;

    const [
      totalMembers,
      pointsIssuedAgg,
      pointsRedeemedAgg,
      totalCoupons,
      totalRedemptions,
      totalGiftCards,
      totalGiftRedemptions,
      totalReferrals,
      rewardedReferrals,
    ] = await Promise.all([
      prisma.user.count({ where: { loyaltyPoints: { gt: 0 } } }),
      prisma.loyaltyTransaction.aggregate({
        where: { type: 'EARN' },
        _sum: { points: true },
      }),
      prisma.loyaltyTransaction.aggregate({
        where: { type: 'REDEEM' },
        _sum: { points: true },
      }),
      prisma.coupon.count(),
      prisma.couponRedemption.count(),
      prisma.giftCard.count(),
      prisma.giftCardRedemption.aggregate({
        _sum: { amount: true },
      }),
      prisma.referral.count(),
      prisma.referral.count({ where: { rewardGranted: true } }),
    ]);

    const totalGiftValue =
      totalGiftCards > 0
        ? Number(
            (await prisma.giftCard.aggregate({ _sum: { originalAmount: true } }))._sum
              .originalAmount || 0
          )
        : 0;
    const totalGiftUsed = Number(totalGiftRedemptions._sum.amount || 0);
    const giftCardUtilization =
      totalGiftValue > 0 ? Math.round((totalGiftUsed / totalGiftValue) * 10000) / 100 : 0;
    const couponRedemptionRate =
      totalCoupons > 0 ? Math.round((totalRedemptions / totalCoupons) * 10000) / 100 : 0;
    const referralConversionRate =
      totalReferrals > 0
        ? Math.round((rewardedReferrals / totalReferrals) * 10000) / 100
        : 0;

    const analytics = {
      totalMembers,
      pointsIssued: pointsIssuedAgg._sum.points || 0,
      pointsRedeemed: Math.abs(pointsRedeemedAgg._sum.points || 0),
      totalCoupons,
      couponRedemptionRate,
      giftCardUtilization,
      referralConversionRate,
    };

    await setCache(cacheKey, analytics);
    return analytics;
  }
  async getFavoritesAnalytics() {
    const cacheKey = 'analytics:favorites';
    const cached = await getCached<{
      totalFavorites: number;
      topFavoritedItems: { menuItemId: string; name: string; count: number }[];
    }>(cacheKey);
    if (cached) return cached;

    const [totalFavorites, topFavorites] = await Promise.all([
      prisma.favoriteMenuItem.count(),
      prisma.favoriteMenuItem.groupBy({
        by: ['menuItemId'],
        _count: { menuItemId: true },
        orderBy: { _count: { menuItemId: 'desc' } },
        take: 10,
      }),
    ]);

    const menuItemIds = topFavorites.map((f) => f.menuItemId);
    const menuItems =
      menuItemIds.length > 0
        ? await prisma.menuItem.findMany({
            where: { id: { in: menuItemIds } },
            select: { id: true, name: true },
          })
        : [];
    const menuItemMap = new Map(menuItems.map((m) => [m.id, m.name]));

    const result = {
      totalFavorites,
      topFavoritedItems: topFavorites.map((f) => ({
        menuItemId: f.menuItemId,
        name: menuItemMap.get(f.menuItemId) || 'Unknown',
        count: f._count.menuItemId,
      })),
    };

    await setCache(cacheKey, result);
    return result;
  }

  async getCustomerRetention() {
    const cacheKey = 'analytics:retention';
    const cached = await getCached<{
      repeatPurchaseRate: number;
      averageLifetimeValue: number;
    }>(cacheKey);
    if (cached) return cached;

    const totalCustomers = await prisma.user.count({
      where: { role: { name: 'CUSTOMER' } },
    });

    const revenueAgg = await prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: { not: 'CANCELLED' } },
    });

    const customersWithOrders = await prisma.order.groupBy({
      by: ['userId'],
      _count: { id: true },
      having: { id: { _count: { gte: 2 } } },
    });

    const repeatPurchaseRate =
      totalCustomers > 0
        ? Math.round((customersWithOrders.length / totalCustomers) * 10000) / 100
        : 0;

    const averageLifetimeValue =
      totalCustomers > 0 && revenueAgg._sum.totalAmount
        ? Math.round((Number(revenueAgg._sum.totalAmount) / totalCustomers) * 100) / 100
        : 0;

    const result = { repeatPurchaseRate, averageLifetimeValue };

    await setCache(cacheKey, result);
    return result;
  }

  async getTopCustomerSegments() {
    const cacheKey = 'analytics:segments';
    const cached = await getCached<{ segments: { range: string; count: number }[] }>(
      cacheKey
    );
    if (cached) return cached;

    const customers = await prisma.user.findMany({
      where: { role: { name: 'CUSTOMER' } },
      select: {
        id: true,
        _count: { select: { orders: true } },
        loyaltyPoints: true,
      },
    });

    const segments = [
      { range: '0 orders', count: customers.filter((c) => c._count.orders === 0).length },
      {
        range: '1-2 orders',
        count: customers.filter((c) => c._count.orders >= 1 && c._count.orders <= 2)
          .length,
      },
      {
        range: '3-5 orders',
        count: customers.filter((c) => c._count.orders >= 3 && c._count.orders <= 5)
          .length,
      },
      { range: '6+ orders', count: customers.filter((c) => c._count.orders >= 6).length },
    ];

    const result = { segments };

    await setCache(cacheKey, result);
    return result;
  }

  async getSupportTicketMetrics() {
    const cacheKey = 'analytics:support';
    const cached = await getCached<{
      open: number;
      inProgress: number;
      resolved: number;
      closed: number;
    }>(cacheKey);
    if (cached) return cached;

    const [open, inProgress, resolved, closed] = await Promise.all([
      prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      prisma.supportTicket.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.supportTicket.count({ where: { status: 'RESOLVED' } }),
      prisma.supportTicket.count({ where: { status: 'CLOSED' } }),
    ]);

    const result = { open, inProgress, resolved, closed };

    await setCache(cacheKey, result);
    return result;
  }

  async getMarketingAnalytics() {
    const cacheKey = 'analytics:marketing';
    const cached = await getCached<{
      totalCampaigns: number;
      campaignDeliveryRate: number;
      campaignOpenRate: number;
      campaignClickRate: number;
      totalVIP: number;
      churnRate: number;
      retentionRate: number;
    }>(cacheKey);
    if (cached) return cached;

    const totalCustomers = await prisma.user.count({
      where: { role: { name: 'CUSTOMER' }, isDeleted: false },
    });

    const [
      totalCampaigns,
      totalSent,
      totalDelivered,
      totalOpened,
      totalClicked,
      segmentStats,
    ] = await Promise.all([
      prisma.marketingCampaign.count(),
      prisma.campaignRecipient.count(),
      prisma.campaignRecipient.count({ where: { isDelivered: true } }),
      prisma.campaignRecipient.count({ where: { isOpened: true } }),
      prisma.campaignRecipient.count({ where: { isClicked: true } }),
      prisma.customerSegment.groupBy({ by: ['segment'], _count: { userId: true } }),
    ]);

    const segmentMap: Record<string, number> = {};
    for (const s of segmentStats) segmentMap[s.segment] = s._count.userId;

    const vipCount = segmentMap['VIP'] || 0;
    const churnedCount = segmentMap['CHURNED'] || 0;
    const atRiskCount = segmentMap['AT_RISK'] || 0;
    const churnRate =
      totalCustomers > 0
        ? Math.round(((churnedCount + atRiskCount) / totalCustomers) * 10000) / 100
        : 0;

    const customersWithOrders = await prisma.order.groupBy({
      by: ['userId'],
      _count: { id: true },
      having: { id: { _count: { gte: 2 } } },
    });
    const retentionRate =
      totalCustomers > 0
        ? Math.round((customersWithOrders.length / totalCustomers) * 10000) / 100
        : 0;

    const result = {
      totalCampaigns,
      campaignDeliveryRate:
        totalSent > 0 ? Math.round((totalDelivered / totalSent) * 10000) / 100 : 0,
      campaignOpenRate:
        totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 10000) / 100 : 0,
      campaignClickRate:
        totalOpened > 0 ? Math.round((totalClicked / totalOpened) * 10000) / 100 : 0,
      totalVIP: vipCount,
      churnRate,
      retentionRate,
    };

    await setCache(cacheKey, result);
    return result;
  }
}

export const analyticsService = new AnalyticsService();
