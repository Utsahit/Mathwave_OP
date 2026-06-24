import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

const branchSelect = {
  id: true,
  code: true,
  name: true,
  email: true,
  phone: true,
  address: true,
  city: true,
  state: true,
  country: true,
  postalCode: true,
  timezone: true,
  isActive: true,
  franchiseId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BranchSelect;

export class BranchRepository {
  async findById(id: string, select?: Prisma.BranchSelect) {
    return prisma.branch.findUnique({
      where: { id },
      select: select ?? branchSelect,
    });
  }

  async findByCode(code: string, select?: Prisma.BranchSelect) {
    return prisma.branch.findUnique({
      where: { code },
      select: select ?? branchSelect,
    });
  }

  async listBranches(
    page = 1,
    pageSize = 20,
    filters?: {
      isActive?: boolean;
      city?: string;
      state?: string;
      country?: string;
      franchiseId?: string;
      search?: string;
    }
  ) {
    const where: Prisma.BranchWhereInput = {};

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }
    if (filters?.city) {
      where.city = { contains: filters.city, mode: 'insensitive' };
    }
    if (filters?.state) {
      where.state = { contains: filters.state, mode: 'insensitive' };
    }
    if (filters?.country) {
      where.country = { contains: filters.country, mode: 'insensitive' };
    }
    if (filters?.franchiseId) {
      where.franchiseId = filters.franchiseId;
    }
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
        { city: { contains: filters.search, mode: 'insensitive' } },
        { state: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      prisma.branch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: branchSelect,
      }),
      prisma.branch.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async createBranch(data: Prisma.BranchCreateInput) {
    return prisma.branch.create({
      data,
      select: branchSelect,
    });
  }

  async updateBranch(id: string, data: Prisma.BranchUpdateInput) {
    return prisma.branch.update({
      where: { id },
      data,
      select: branchSelect,
    });
  }

  async deleteBranch(id: string) {
    return prisma.branch.update({
      where: { id },
      data: { isActive: false },
      select: branchSelect,
    });
  }
}

export const branchRepository = new BranchRepository();
