import { prisma } from '../config/prisma';

import { AppError } from '../utils/app-error';
import { auditService } from './audit.service';
import { notificationService } from './notification.service';

export class BranchStaffService {
  async assignStaff(branchId: string, userId: string, adminUserId: string) {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true },
    });
    if (!branch) {
      throw new AppError('Branch not found.', 404, 'BRANCH_NOT_FOUND');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    if (!user) {
      throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    }

    const existing = await prisma.branchStaff.findUnique({
      where: { branchId_userId: { branchId, userId } },
    });
    if (existing) {
      throw new AppError(
        'Staff member already assigned to this branch.',
        409,
        'DUPLICATE_STAFF'
      );
    }

    const staff = await prisma.branchStaff.create({
      data: { branchId, userId },
      select: { id: true, branchId: true, userId: true, createdAt: true },
    });

    auditService
      .logCreate(adminUserId, 'BranchStaff', staff.id, {
        branchId,
        userId,
        userName: user.name,
      })
      .catch(() => {});

    notificationService
      .create(
        userId,
        user.email,
        'BRANCH_MANAGER_ASSIGNED',
        'Branch Assignment',
        `You have been assigned to branch "${branch.name}".`,
        'IN_APP',
        { branchId, branchName: branch.name }
      )
      .catch(() => {});

    return staff;
  }

  async removeStaff(branchId: string, userId: string, adminUserId: string) {
    const existing = await prisma.branchStaff.findUnique({
      where: { branchId_userId: { branchId, userId } },
      include: { branch: { select: { name: true } } },
    });
    if (!existing) {
      throw new AppError('Staff assignment not found.', 404, 'STAFF_NOT_FOUND');
    }

    await prisma.branchStaff.delete({
      where: { id: existing.id },
    });

    auditService
      .logDelete(adminUserId, 'BranchStaff', existing.id, {
        branchId,
        userId,
      })
      .catch(() => {});

    return { message: 'Staff removed from branch.' };
  }

  async listStaff(branchId: string, page = 1, pageSize = 20) {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true },
    });
    if (!branch) {
      throw new AppError('Branch not found.', 404, 'BRANCH_NOT_FOUND');
    }

    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      prisma.branchStaff.findMany({
        where: { branchId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          createdAt: true,
          branch: { select: { name: true } },
        },
      }),
      prisma.branchStaff.count({ where: { branchId } }),
    ]);

    const userIds = data.map((s) => s.userId);
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    const items = data.map((s) => ({
      ...s,
      user: userMap.get(s.userId) || null,
    }));

    return { data: items, total, page, pageSize };
  }
}

export const branchStaffService = new BranchStaffService();
