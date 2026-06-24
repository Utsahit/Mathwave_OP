import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

export class MenuRepository {
  // ── Category CRUD ──

  async createCategory(data: Prisma.MenuCategoryCreateInput) {
    return prisma.menuCategory.create({ data });
  }

  async findCategoryById(id: string) {
    return prisma.menuCategory.findFirst({
      where: { id, isDeleted: false },
    });
  }

  async findCategoryBySlug(slug: string) {
    return prisma.menuCategory.findFirst({
      where: { slug, isDeleted: false },
    });
  }

  async findCategoryByName(name: string) {
    return prisma.menuCategory.findFirst({
      where: { name, isDeleted: false },
    });
  }

  async updateCategory(id: string, data: Prisma.MenuCategoryUpdateInput) {
    return prisma.menuCategory.update({
      where: { id },
      data,
    });
  }

  async softDeleteCategory(id: string) {
    return prisma.menuCategory.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  async listCategories(filters: { search?: string; page: number; limit: number }) {
    const where: Prisma.MenuCategoryWhereInput = { isDeleted: false };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      prisma.menuCategory.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { name: 'asc' },
      }),
      prisma.menuCategory.count({ where }),
    ]);

    return { items, total };
  }

  // ── MenuItem CRUD ──

  async createMenuItem(data: Prisma.MenuItemUncheckedCreateInput) {
    return prisma.menuItem.create({ data });
  }

  async findMenuItemById(id: string) {
    return prisma.menuItem.findFirst({
      where: { id, isDeleted: false },
      include: { category: true },
    });
  }

  async findMenuItemBySlug(slug: string) {
    return prisma.menuItem.findFirst({
      where: { slug, isDeleted: false },
      include: { category: true },
    });
  }

  async findMenuItemByName(name: string) {
    return prisma.menuItem.findFirst({
      where: { name, isDeleted: false },
      include: { category: true },
    });
  }

  async updateMenuItem(id: string, data: Prisma.MenuItemUncheckedUpdateInput) {
    return prisma.menuItem.update({
      where: { id },
      data,
      include: { category: true },
    });
  }

  async softDeleteMenuItem(id: string) {
    return prisma.menuItem.update({
      where: { id },
      data: { isDeleted: true },
      include: { category: true },
    });
  }

  async listMenuItems(filters: {
    search?: string;
    categoryId?: string;
    featured?: boolean;
    active?: boolean;
    sortBy: 'name' | 'price' | 'createdAt';
    order: 'asc' | 'desc';
    page: number;
    limit: number;
  }) {
    const where: Prisma.MenuItemWhereInput = { isDeleted: false };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.featured !== undefined) {
      where.isFeatured = filters.featured;
    }

    if (filters.active !== undefined) {
      where.isActive = filters.active;
    }

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      prisma.menuItem.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { [filters.sortBy]: filters.order },
        include: { category: true },
      }),
      prisma.menuItem.count({ where }),
    ]);

    return { items, total };
  }

  // ── Public Access (Optimized) ──

  async getPublicMenu() {
    return prisma.menuCategory.findMany({
      where: { isDeleted: false },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        items: {
          where: { isDeleted: false, isActive: true },
          orderBy: { name: 'asc' },
          // Select only fields rendered in the public menu — never fetch audit columns
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            price: true,
            image: true,
            tag: true,
            isFeatured: true,
            isActive: true,
          },
        },
      },
    });
  }

  async getPublicCategories() {
    return prisma.menuCategory.findMany({
      where: { isDeleted: false },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, description: true },
    });
  }
}

export const menuRepository = new MenuRepository();
