import { prisma } from '../config/prisma';

import { AppError } from '../utils/app-error';
import { auditService } from './audit.service';
import { notificationService } from './notification.service';
import { InventoryTransferStatus, StockMovementType } from '@prisma/client';

export class InventoryTransferService {
  async createTransfer(
    fromBranchId: string,
    toBranchId: string,
    items: { ingredientId: string; quantity: number }[],
    adminUserId: string
  ) {
    const [fromBranch, toBranch] = await Promise.all([
      prisma.branch.findUnique({
        where: { id: fromBranchId },
        select: { id: true, name: true },
      }),
      prisma.branch.findUnique({
        where: { id: toBranchId },
        select: { id: true, name: true },
      }),
    ]);

    if (!fromBranch) {
      throw new AppError('Source branch not found.', 404, 'BRANCH_NOT_FOUND');
    }
    if (!toBranch) {
      throw new AppError('Destination branch not found.', 404, 'BRANCH_NOT_FOUND');
    }

    if (items.length === 0) {
      throw new AppError('Transfer must include at least one item.', 400, 'NO_ITEMS');
    }

    const ingredientIds = [...new Set(items.map((i) => i.ingredientId))];
    const ingredients = await prisma.ingredient.findMany({
      where: { id: { in: ingredientIds } },
      select: { id: true, name: true },
    });

    if (ingredients.length !== ingredientIds.length) {
      throw new AppError(
        'One or more ingredients not found.',
        404,
        'INGREDIENT_NOT_FOUND'
      );
    }

    const transfer = await prisma.inventoryTransfer.create({
      data: {
        fromBranchId,
        toBranchId,
        status: 'PENDING',
        items: {
          create: items.map((item) => ({
            ingredientId: item.ingredientId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        items: {
          include: { ingredient: { select: { name: true } } },
        },
      },
    });

    auditService
      .logCreate(adminUserId, 'InventoryTransfer', transfer.id, {
        fromBranchId,
        toBranchId,
        itemCount: items.length,
      })
      .catch(() => {});

    notificationService
      .create(
        null,
        null,
        'INVENTORY_TRANSFER_CREATED',
        'Inventory Transfer Created',
        `Transfer from "${fromBranch.name}" to "${toBranch.name}" has been created.`,
        'IN_APP',
        { transferId: transfer.id, fromBranchId, toBranchId }
      )
      .catch(() => {});

    return transfer;
  }

  async approveTransfer(id: string, adminUserId: string) {
    const transfer = await prisma.inventoryTransfer.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!transfer) {
      throw new AppError('Transfer not found.', 404, 'NOT_FOUND');
    }
    if (transfer.status !== 'PENDING') {
      throw new AppError(
        'Only pending transfers can be approved.',
        400,
        'INVALID_STATUS'
      );
    }

    const updated = await prisma.inventoryTransfer.update({
      where: { id },
      data: { status: 'APPROVED' },
      select: { id: true, status: true, updatedAt: true },
    });

    auditService
      .logStatusChange(adminUserId, 'InventoryTransfer', id, 'PENDING', 'APPROVED')
      .catch(() => {});

    return updated;
  }

  async completeTransfer(id: string, adminUserId: string) {
    const transfer = await prisma.inventoryTransfer.findUnique({
      where: { id },
      include: {
        items: { select: { ingredientId: true, quantity: true } },
      },
    });

    if (!transfer) {
      throw new AppError('Transfer not found.', 404, 'NOT_FOUND');
    }
    if (transfer.status !== 'APPROVED') {
      throw new AppError(
        'Only approved transfers can be completed.',
        400,
        'INVALID_STATUS'
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.inventoryTransfer.update({
        where: { id },
        data: { status: 'COMPLETED' },
        select: {
          id: true,
          status: true,
          updatedAt: true,
          fromBranchId: true,
          toBranchId: true,
        },
      });

      for (const item of transfer.items) {
        const qty = Number(item.quantity);

        await tx.ingredient.update({
          where: { id: item.ingredientId },
          data: { currentStock: { decrement: qty } },
        });

        await tx.stockMovement.create({
          data: {
            ingredientId: item.ingredientId,
            type: StockMovementType.MANUAL_ADJUSTMENT,
            quantity: -qty,
            referenceId: `transfer-out:${id}`,
          },
        });

        await tx.ingredient.update({
          where: { id: item.ingredientId },
          data: { currentStock: { increment: qty } },
        });

        await tx.stockMovement.create({
          data: {
            ingredientId: item.ingredientId,
            type: StockMovementType.MANUAL_ADJUSTMENT,
            quantity: qty,
            referenceId: `transfer-in:${id}`,
          },
        });
      }

      return updated;
    });

    auditService
      .logStatusChange(adminUserId, 'InventoryTransfer', id, 'APPROVED', 'COMPLETED')
      .catch(() => {});

    notificationService
      .create(
        null,
        null,
        'INVENTORY_TRANSFER_COMPLETED',
        'Inventory Transfer Completed',
        `Inventory transfer ${id} has been completed.`,
        'IN_APP',
        {
          transferId: id,
          fromBranchId: transfer.fromBranchId,
          toBranchId: transfer.toBranchId,
        }
      )
      .catch(() => {});

    return result;
  }

  async cancelTransfer(id: string, adminUserId: string) {
    const transfer = await prisma.inventoryTransfer.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!transfer) {
      throw new AppError('Transfer not found.', 404, 'NOT_FOUND');
    }
    if (transfer.status === 'COMPLETED' || transfer.status === 'CANCELLED') {
      throw new AppError(
        'Cannot cancel a completed or already cancelled transfer.',
        400,
        'INVALID_STATUS'
      );
    }

    const updated = await prisma.inventoryTransfer.update({
      where: { id },
      data: { status: 'CANCELLED' },
      select: { id: true, status: true, updatedAt: true },
    });

    auditService
      .logStatusChange(adminUserId, 'InventoryTransfer', id, transfer.status, 'CANCELLED')
      .catch(() => {});

    return updated;
  }

  async listTransfers(
    page = 1,
    pageSize = 20,
    filters?: {
      status?: InventoryTransferStatus;
      fromBranchId?: string;
      toBranchId?: string;
    }
  ) {
    const where: Record<string, unknown> = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.fromBranchId) where.fromBranchId = filters.fromBranchId;
    if (filters?.toBranchId) where.toBranchId = filters.toBranchId;

    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      prisma.inventoryTransfer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          fromBranch: { select: { id: true, name: true, code: true } },
          toBranch: { select: { id: true, name: true, code: true } },
          items: {
            include: { ingredient: { select: { id: true, name: true, unit: true } } },
          },
        },
      }),
      prisma.inventoryTransfer.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }
}

export const inventoryTransferService = new InventoryTransferService();
