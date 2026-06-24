import { prisma } from '../config/prisma';
import { AppError } from '../utils/app-error';

export const SUPPLIER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  address: true,
  isActive: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
};

export const SUPPLIER_INGREDIENT_SELECT = {
  id: true,
  supplierId: true,
  ingredientId: true,
  pricePerUnit: true,
  ingredient: {
    select: {
      id: true,
      name: true,
      sku: true,
      unit: true,
    },
  },
};

export class SupplierService {
  async createSupplier(data: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  }) {
    const existing = await prisma.supplier.findFirst({
      where: { name: data.name, isDeleted: false },
      select: { id: true },
    });
    if (existing) {
      throw new AppError(
        'A supplier with this name already exists.',
        409,
        'DUPLICATE_NAME'
      );
    }

    return prisma.supplier.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
      },
      select: SUPPLIER_SELECT,
    });
  }

  async getSupplier(id: string) {
    const supplier = await prisma.supplier.findFirst({
      where: { id, isDeleted: false },
      select: SUPPLIER_SELECT,
    });
    if (!supplier) {
      throw new AppError('Supplier not found.', 404, 'NOT_FOUND');
    }
    return supplier;
  }

  async updateSupplier(
    id: string,
    data: {
      name?: string;
      email?: string | null;
      phone?: string | null;
      address?: string | null;
      isActive?: boolean;
    }
  ) {
    const existing = await this.getSupplier(id);

    if (data.name && data.name !== existing.name) {
      const dupeName = await prisma.supplier.findFirst({
        where: { name: data.name, isDeleted: false },
        select: { id: true },
      });
      if (dupeName) {
        throw new AppError(
          'A supplier with this name already exists.',
          409,
          'DUPLICATE_NAME'
        );
      }
    }

    return prisma.supplier.update({
      where: { id },
      data,
      select: SUPPLIER_SELECT,
    });
  }

  async deleteSupplier(id: string) {
    await this.getSupplier(id);
    return prisma.supplier.update({
      where: { id },
      data: { isDeleted: true, isActive: false },
      select: SUPPLIER_SELECT,
    });
  }

  async listSuppliers(filters: {
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
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        select: SUPPLIER_SELECT,
        orderBy: { name: 'asc' },
        skip,
        take: filters.limit,
      }),
      prisma.supplier.count({ where }),
    ]);

    return { items, total };
  }

  async addOrUpdateIngredient(
    supplierId: string,
    ingredientId: string,
    pricePerUnit: number
  ) {
    await this.getSupplier(supplierId);

    // Verify ingredient exists
    const ingredient = await prisma.ingredient.findFirst({
      where: { id: ingredientId, isDeleted: false },
      select: { id: true },
    });
    if (!ingredient) {
      throw new AppError('Ingredient not found.', 404, 'NOT_FOUND');
    }

    return prisma.supplierIngredient.upsert({
      where: {
        supplierId_ingredientId: {
          supplierId,
          ingredientId,
        },
      },
      update: { pricePerUnit },
      create: { supplierId, ingredientId, pricePerUnit },
      select: SUPPLIER_INGREDIENT_SELECT,
    });
  }

  async removeIngredient(supplierId: string, ingredientId: string) {
    await this.getSupplier(supplierId);
    return prisma.supplierIngredient.delete({
      where: {
        supplierId_ingredientId: {
          supplierId,
          ingredientId,
        },
      },
      select: { id: true },
    });
  }

  async listSupplierIngredients(supplierId: string) {
    await this.getSupplier(supplierId);
    return prisma.supplierIngredient.findMany({
      where: { supplierId },
      select: SUPPLIER_INGREDIENT_SELECT,
    });
  }
}

export const supplierService = new SupplierService();
