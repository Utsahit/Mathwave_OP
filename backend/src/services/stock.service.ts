import { prisma } from '../config/prisma';
import { getRedisClient } from '../config/redis';
import { AppError } from '../utils/app-error';
import { StockMovementType } from '@prisma/client';

const STATS_TTL = 300; // 5 minutes

export class StockService {
  async clearCache() {
    try {
      const redis = getRedisClient();
      await Promise.all([redis.del('inventory:stats'), redis.del('inventory:low-stock')]);
    } catch {
      // Silent fail
    }
  }

  async consumeStockForOrder(orderId: string, txInput?: any) {
    const runInTx = async (tx: any) => {
      // 1. Atomically claim this order for consumption.
      //    Only one concurrent transaction can succeed (the first to write).
      //    Matching rows: 1 = we claimed it; 0 = already consumed.
      const claim = await tx.order.updateMany({
        where: { id: orderId, stockConsumedAt: null },
        data: { stockConsumedAt: new Date() },
      });
      if (claim.count === 0) {
        return;
      }

      // 2. Read order details (we are the sole consumer now)
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          items: {
            select: {
              menuItemId: true,
              quantity: true,
              menuItem: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!order) {
        throw new AppError('Order not found.', 404, 'NOT_FOUND');
      }

      // 3. Resolve recipe requirements for all order items in a single batch query
      const menuItemIds = [
        ...new Set(
          order.items.map((i: { menuItemId: string; quantity: number }) => i.menuItemId)
        ),
      ];
      const allRecipes = await tx.menuItemIngredient.findMany({
        where: { menuItemId: { in: menuItemIds } },
        select: {
          menuItemId: true,
          ingredientId: true,
          quantity: true,
          ingredient: { select: { name: true } },
        },
      });
      const recipeByItem = new Map<string, typeof allRecipes>();
      for (const r of allRecipes) {
        const arr = recipeByItem.get(r.menuItemId) || [];
        arr.push(r);
        recipeByItem.set(r.menuItemId, arr);
      }

      const requirements: Record<string, { quantity: number; name: string }> = {};
      for (const item of order.items) {
        const recipe = recipeByItem.get(item.menuItemId) || [];
        for (const recipeItem of recipe) {
          const reqQty = Number(recipeItem.quantity) * item.quantity;
          if (requirements[recipeItem.ingredientId]) {
            requirements[recipeItem.ingredientId].quantity += reqQty;
          } else {
            requirements[recipeItem.ingredientId] = {
              quantity: reqQty,
              name: recipeItem.ingredient.name,
            };
          }
        }
      }

      // 4. Verify stock availability in a single batch query
      const ingredientIds = Object.keys(requirements);
      const ingredients: { id: string; currentStock: number; name: string }[] =
        ingredientIds.length > 0
          ? await tx.ingredient.findMany({
              where: { id: { in: ingredientIds } },
              select: { id: true, currentStock: true, name: true },
            })
          : [];
      const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));
      for (const [ingredientId, req] of Object.entries(requirements)) {
        const ingredient = ingredientMap.get(ingredientId);
        if (!ingredient || Number(ingredient.currentStock) < req.quantity) {
          throw new AppError(
            `Insufficient stock for ingredient: ${req.name}. Required: ${req.quantity}, Available: ${
              ingredient ? ingredient.currentStock : 0
            }`,
            409,
            'INSUFFICIENT_STOCK'
          );
        }
      }

      // 5. Perform stock deductions and create movements
      for (const [ingredientId, req] of Object.entries(requirements)) {
        await tx.ingredient.update({
          where: { id: ingredientId },
          data: { currentStock: { decrement: req.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            ingredientId,
            type: StockMovementType.CONSUMPTION,
            quantity: req.quantity,
            referenceId: orderId,
          },
        });
      }
    };

    if (txInput) {
      await runInTx(txInput);
    } else {
      await prisma.$transaction(async (tx) => {
        await runInTx(tx);
      });
    }

    await this.clearCache();
  }

  async makeManualAdjustment(ingredientId: string, quantity: number, comment?: string) {
    const ingredient = await prisma.ingredient.findFirst({
      where: { id: ingredientId, isDeleted: false },
      select: { id: true, currentStock: true },
    });

    if (!ingredient) {
      throw new AppError('Ingredient not found.', 404, 'NOT_FOUND');
    }

    // Prevent stock from going negative
    const newStock = Number(ingredient.currentStock) + quantity;
    if (newStock < 0) {
      throw new AppError(
        'Stock adjustment would result in negative stock.',
        400,
        'NEGATIVE_STOCK'
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.ingredient.update({
        where: { id: ingredientId },
        data: {
          currentStock: {
            increment: quantity,
          },
        },
      });

      return tx.stockMovement.create({
        data: {
          ingredientId,
          type: StockMovementType.MANUAL_ADJUSTMENT,
          quantity,
          referenceId: comment || 'manual adjustment',
        },
      });
    });

    await this.clearCache();
    return result;
  }

  async getLowStockIngredients(filters: { page: number; limit: number }) {
    const redis = getRedisClient();
    const cacheKey = 'inventory:low-stock';

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return this.paginateFromCache(parsed, filters.page, filters.limit);
      }
    } catch {
      // Silent fail
    }

    // Raw SQL required: Prisma's query builder does not support column-to-column
    // comparison (e.g. currentStock <= minimumStock). We use $queryRaw to find
    // low-stock ingredients, then hydrate full records via select().
    const allLowStock = await prisma.$queryRaw<
      {
        id: string;
        name: string;
        sku: string | null;
        unit: string;
        currentStock: number;
        minimumStock: number;
        costPerUnit: number;
      }[]
    >`
      SELECT id, name, sku, unit, "currentStock", "minimumStock", "costPerUnit"
      FROM "Ingredient"
      WHERE "isDeleted" = false AND "isActive" = true AND "currentStock" <= "minimumStock"
      ORDER BY name ASC
    `;

    const items = allLowStock.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      currentStock: item.currentStock,
      minimumStock: item.minimumStock,
      costPerUnit: item.costPerUnit,
      supplierCount: 0,
    }));

    const total = items.length;

    // Fetch supplier counts in batch for items with IDs
    if (items.length > 0) {
      const ids = items.map((i) => i.id);
      const supplierCounts = await prisma.supplierIngredient.groupBy({
        by: ['ingredientId'],
        where: { ingredientId: { in: ids } },
        _count: { ingredientId: true },
      });
      const countMap = new Map(
        supplierCounts.map((s) => [s.ingredientId, s._count.ingredientId])
      );
      for (const item of items) {
        item.supplierCount = countMap.get(item.id) || 0;
      }
    }

    const cachePayload = { items, total };

    try {
      await redis.set(cacheKey, JSON.stringify(cachePayload), 'EX', STATS_TTL);
    } catch {
      // Silent fail
    }

    return this.paginateFromCache(cachePayload, filters.page, filters.limit);
  }

  private paginateFromCache(
    data: { items: any[]; total: number },
    page: number,
    limit: number
  ) {
    const start = (page - 1) * limit;
    const paginatedItems = data.items.slice(start, start + limit);
    return { items: paginatedItems, total: data.total };
  }

  async getInventoryStats() {
    const redis = getRedisClient();
    const cacheKey = 'inventory:stats';

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Silent fail
    }

    const totalIngredients = await prisma.ingredient.count({
      where: { isDeleted: false, isActive: true },
    });

    const lowStockCountRes = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint FROM "Ingredient"
      WHERE "isDeleted" = false AND "isActive" = true AND "currentStock" <= "minimumStock"
    `;
    const lowStockCount = Number(lowStockCountRes[0]?.count || 0);

    const totalValueRes = await prisma.$queryRaw<{ total_value: number | null }[]>`
      SELECT SUM("currentStock" * "costPerUnit")::float as total_value
      FROM "Ingredient"
      WHERE "isDeleted" = false AND "isActive" = true
    `;
    const totalInventoryValue = totalValueRes[0]?.total_value || 0;

    const topConsumedRaw = await prisma.stockMovement.groupBy({
      by: ['ingredientId'],
      where: {
        type: StockMovementType.CONSUMPTION,
      },
      _sum: {
        quantity: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: 5,
    });

    const ingredientIds = topConsumedRaw.map((r) => r.ingredientId);
    const ingredients =
      ingredientIds.length > 0
        ? await prisma.ingredient.findMany({
            where: { id: { in: ingredientIds } },
            select: { id: true, name: true, unit: true },
          })
        : [];

    const topConsumedIngredients = topConsumedRaw.map((sm) => {
      const ing = ingredients.find((i) => i.id === sm.ingredientId);
      return {
        ingredientId: sm.ingredientId,
        name: ing ? ing.name : 'Unknown',
        unit: ing ? ing.unit : '',
        totalConsumed: Number(sm._sum.quantity || 0),
      };
    });

    const stats = {
      totalIngredients,
      lowStockCount,
      totalInventoryValue,
      topConsumedIngredients,
    };

    try {
      await redis.set(cacheKey, JSON.stringify(stats), 'EX', STATS_TTL);
    } catch {
      // Silent fail
    }

    return stats;
  }

  async listStockMovements(filters: {
    ingredientId?: string;
    page: number;
    limit: number;
  }) {
    const where: any = {};
    if (filters.ingredientId) {
      where.ingredientId = filters.ingredientId;
    }

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        select: {
          id: true,
          ingredientId: true,
          type: true,
          quantity: true,
          referenceId: true,
          createdAt: true,
          ingredient: {
            select: {
              name: true,
              unit: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return { items, total };
  }
}

export const stockService = new StockService();
