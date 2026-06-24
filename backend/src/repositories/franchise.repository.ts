import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

const franchiseSelect = {
  id: true,
  code: true,
  name: true,
  ownerName: true,
  ownerEmail: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.FranchiseSelect;

export class FranchiseRepository {
  async findById(id: string, select?: Prisma.FranchiseSelect) {
    return prisma.franchise.findUnique({
      where: { id },
      select: select ?? franchiseSelect,
    });
  }

  async findByCode(code: string, select?: Prisma.FranchiseSelect) {
    return prisma.franchise.findUnique({
      where: { code },
      select: select ?? franchiseSelect,
    });
  }

  async listFranchises(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      prisma.franchise.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: franchiseSelect,
      }),
      prisma.franchise.count(),
    ]);

    return { data, total, page, pageSize };
  }

  async createFranchise(data: Prisma.FranchiseCreateInput) {
    return prisma.franchise.create({
      data,
      select: franchiseSelect,
    });
  }

  async updateFranchise(id: string, data: Prisma.FranchiseUpdateInput) {
    return prisma.franchise.update({
      where: { id },
      data,
      select: franchiseSelect,
    });
  }
}

export const franchiseRepository = new FranchiseRepository();
