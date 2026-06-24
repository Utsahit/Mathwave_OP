import { prisma } from '../config/prisma';
import { AppError } from '../utils/app-error';

export const INGREDIENT_SELECT = {
  id: true,
  name: true,
  sku: true,
  unit: true,
  currentStock: true,
  minimumStock: true,
  costPerUnit: true,
  isActive: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
};

export class IngredientService {
  async createIngredient(data: {
    name: string;
    sku?: string | null;
    unit: string;
    currentStock: number;
    minimumStock: number;
    costPerUnit: number;
  }) {
    // Check uniqueness of name
    const existingName = await prisma.ingredient.findFirst({
      where: { name: data.name, isDeleted: false },
      select: { id: true },
    });
    if (existingName) {
      throw new AppError(
        'An ingredient with this name already exists.',
        409,
        'DUPLICATE_NAME'
      );
    }

    if (data.sku) {
      const existingSku = await prisma.ingredient.findFirst({
        where: { sku: data.sku, isDeleted: false },
        select: { id: true },
      });
      if (existingSku) {
        throw new AppError(
          'An ingredient with this SKU already exists.',
          409,
          'DUPLICATE_SKU'
        );
      }
    }

    return prisma.ingredient.create({
      data: {
        name: data.name,
        sku: data.sku,
        unit: data.unit,
        currentStock: data.currentStock,
        minimumStock: data.minimumStock,
        costPerUnit: data.costPerUnit,
      },
      select: INGREDIENT_SELECT,
    });
  }

  async getIngredient(id: string) {
    const ingredient = await prisma.ingredient.findFirst({
      where: { id, isDeleted: false },
      select: INGREDIENT_SELECT,
    });
    if (!ingredient) {
      throw new AppError('Ingredient not found.', 404, 'NOT_FOUND');
    }
    return ingredient;
  }

  async updateIngredient(
    id: string,
    data: {
      name?: string;
      sku?: string | null;
      unit?: string;
      currentStock?: number;
      minimumStock?: number;
      costPerUnit?: number;
      isActive?: boolean;
    }
  ) {
    const existing = await this.getIngredient(id);

    if (data.name && data.name !== existing.name) {
      const dupeName = await prisma.ingredient.findFirst({
        where: { name: data.name, isDeleted: false },
        select: { id: true },
      });
      if (dupeName) {
        throw new AppError(
          'An ingredient with this name already exists.',
          409,
          'DUPLICATE_NAME'
        );
      }
    }

    if (data.sku && data.sku !== existing.sku) {
      const dupeSku = await prisma.ingredient.findFirst({
        where: { sku: data.sku, isDeleted: false },
        select: { id: true },
      });
      if (dupeSku) {
        throw new AppError(
          'An ingredient with this SKU already exists.',
          409,
          'DUPLICATE_SKU'
        );
      }
    }

    return prisma.ingredient.update({
      where: { id },
      data,
      select: INGREDIENT_SELECT,
    });
  }

  async deleteIngredient(id: string) {
    await this.getIngredient(id);
    return prisma.ingredient.update({
      where: { id },
      data: { isDeleted: true, isActive: false },
      select: INGREDIENT_SELECT,
    });
  }

  async listIngredients(filters: {
    isActive?: boolean;
    search?: string;
    page: number;
    limit: number;
  }) {
    const where: any = { isDeleted: false };

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { sku: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      prisma.ingredient.findMany({
        where,
        select: INGREDIENT_SELECT,
        orderBy: { name: 'asc' },
        skip,
        take: filters.limit,
      }),
      prisma.ingredient.count({ where }),
    ]);

    return { items, total };
  }
}

export const ingredientService = new IngredientService();
