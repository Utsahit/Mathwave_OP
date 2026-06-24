import { prisma } from '../config/prisma';
import { AppError } from '../utils/app-error';
import { PurchaseOrderStatus, StockMovementType } from '@prisma/client';

export const PURCHASE_ORDER_SELECT = {
  id: true,
  poNumber: true,
  supplierId: true,
  status: true,
  totalAmount: true,
  createdAt: true,
  updatedAt: true,
  supplier: {
    select: {
      id: true,
      name: true,
    },
  },
  items: {
    select: {
      id: true,
      ingredientId: true,
      quantity: true,
      unitCost: true,
      ingredient: {
        select: {
          id: true,
          name: true,
          sku: true,
          unit: true,
        },
      },
    },
  },
  statusHistory: {
    select: {
      id: true,
      oldStatus: true,
      newStatus: true,
      changedBy: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc' as const,
    },
  },
};

export class PurchaseOrderService {
  async createPurchaseOrder(
    data: {
      supplierId: string;
      items: { ingredientId: string; quantity: number; unitCost: number }[];
    },
    changedBy: string
  ) {
    // Verify supplier exists
    const supplier = await prisma.supplier.findFirst({
      where: { id: data.supplierId, isDeleted: false },
      select: { id: true },
    });
    if (!supplier) {
      throw new AppError('Supplier not found.', 404, 'NOT_FOUND');
    }

    // Verify all ingredients exist
    const ingredientIds = data.items.map((i) => i.ingredientId);
    const dbIngredients = await prisma.ingredient.findMany({
      where: { id: { in: ingredientIds }, isDeleted: false },
      select: { id: true },
    });
    if (dbIngredients.length !== ingredientIds.length) {
      throw new AppError(
        'One or more ingredients do not exist or are deleted.',
        400,
        'INVALID_INGREDIENT'
      );
    }

    // Generate unique PO number (e.g. PO-YYYYMMDD-XXXX)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const poNumber = `PO-${dateStr}-${rand}`;

    const totalAmount = data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0
    );

    return prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: data.supplierId,
          status: PurchaseOrderStatus.DRAFT,
          totalAmount,
          items: {
            create: data.items.map((item) => ({
              ingredientId: item.ingredientId,
              quantity: item.quantity,
              unitCost: item.unitCost,
            })),
          },
          statusHistory: {
            create: {
              oldStatus: PurchaseOrderStatus.DRAFT,
              newStatus: PurchaseOrderStatus.DRAFT,
              changedBy,
            },
          },
        },
        select: PURCHASE_ORDER_SELECT,
      });

      return po;
    });
  }

  async getPurchaseOrder(id: string) {
    // Basic sorting adjustment since statusHistory doesn't directly nested sort without custom prisma schema support
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: {
        id: true,
        poNumber: true,
        supplierId: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        updatedAt: true,
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          select: {
            id: true,
            ingredientId: true,
            quantity: true,
            unitCost: true,
            ingredient: {
              select: {
                id: true,
                name: true,
                sku: true,
                unit: true,
              },
            },
          },
        },
        statusHistory: {
          select: {
            id: true,
            oldStatus: true,
            newStatus: true,
            changedBy: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!po) {
      throw new AppError('Purchase order not found.', 404, 'NOT_FOUND');
    }
    return po;
  }

  async updatePurchaseOrderStatus(
    id: string,
    newStatus: PurchaseOrderStatus,
    changedBy: string
  ) {
    const po = await this.getPurchaseOrder(id);

    if (po.status === PurchaseOrderStatus.RECEIVED) {
      if (newStatus === PurchaseOrderStatus.RECEIVED) {
        throw new AppError(
          'Cannot receive an already received purchase order.',
          422,
          'ALREADY_RECEIVED'
        );
      }
      throw new AppError(
        'Cannot change status of a received purchase order.',
        422,
        'ALREADY_RECEIVED'
      );
    }

    if (po.status === PurchaseOrderStatus.CANCELLED) {
      throw new AppError(
        'Cannot change status of a cancelled purchase order.',
        422,
        'ALREADY_CANCELLED'
      );
    }

    if (po.status === newStatus) {
      return po;
    }

    return prisma.$transaction(async (tx) => {
      // Create audit history
      await tx.purchaseOrderHistory.create({
        data: {
          purchaseOrderId: id,
          oldStatus: po.status,
          newStatus,
          changedBy,
        },
      });

      // Update PurchaseOrder status
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: newStatus },
      });

      // If status transitioning to RECEIVED, increment stock and log movement
      if (newStatus === PurchaseOrderStatus.RECEIVED) {
        for (const item of po.items) {
          // Increment ingredient stock
          await tx.ingredient.update({
            where: { id: item.ingredientId },
            data: {
              currentStock: {
                increment: item.quantity,
              },
            },
          });

          // Create stock movement row
          await tx.stockMovement.create({
            data: {
              ingredientId: item.ingredientId,
              type: StockMovementType.PURCHASE,
              quantity: item.quantity,
              referenceId: id,
            },
          });
        }
      }

      return tx.purchaseOrder.findUnique({
        where: { id },
        select: {
          id: true,
          poNumber: true,
          supplierId: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          updatedAt: true,
          supplier: {
            select: { id: true, name: true },
          },
          items: {
            select: {
              id: true,
              ingredientId: true,
              quantity: true,
              unitCost: true,
              ingredient: { select: { id: true, name: true, sku: true, unit: true } },
            },
          },
          statusHistory: {
            select: {
              id: true,
              oldStatus: true,
              newStatus: true,
              changedBy: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' as const },
          },
        },
      });
    });
  }

  async listPurchaseOrders(filters: {
    status?: PurchaseOrderStatus;
    page: number;
    limit: number;
    branchIds?: string[];
  }) {
    const where: any = {};
    if (filters.branchIds) {
      where.branchId = { in: filters.branchIds };
    }
    if (filters.status) {
      where.status = filters.status;
    }

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        select: {
          id: true,
          poNumber: true,
          supplierId: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          updatedAt: true,
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return { items, total };
  }
}

export const purchaseOrderService = new PurchaseOrderService();
