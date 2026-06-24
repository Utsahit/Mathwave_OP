import { menuRepository } from '../repositories/menu.repository';
import { getRedisClient } from '../config/redis';
import { AppError } from '../utils/app-error';
import { Decimal } from '@prisma/client/runtime/library';

// Helper to generate a slug from a string
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-'); // Replace multiple - with single -
}

export class MenuService {
  private cacheTTL = 86400; // 24 hours in seconds

  // ── Redis Cache Helpers ──

  private async invalidateCache() {
    try {
      const redis = getRedisClient();
      await Promise.all([
        redis.del('menu:public:all'),
        redis.del('menu:public:categories'),
      ]);
    } catch {
      // Ignore cache invalidation failures during tests/normal execution
    }
  }

  // ── Category Service ──

  async createCategory(data: {
    name: string;
    slug?: string;
    description?: string;
    displayOrder?: number;
    isActive?: boolean;
  }) {
    const slug = data.slug ? slugify(data.slug) : slugify(data.name);

    // Verify unique slug
    const existing = await menuRepository.findCategoryBySlug(slug);
    if (existing) {
      throw new AppError('Category slug already exists.', 409, 'DUPLICATE_SLUG');
    }

    const category = await menuRepository.createCategory({
      name: data.name,
      slug,
      description: data.description,
      isDeleted: false,
    });

    await this.invalidateCache();
    return category;
  }

  async getCategory(id: string) {
    const category = await menuRepository.findCategoryById(id);
    if (!category) {
      throw new AppError('Category not found.', 404, 'CATEGORY_NOT_FOUND');
    }
    return category;
  }

  async updateCategory(
    id: string,
    data: {
      name?: string;
      slug?: string;
      description?: string;
      displayOrder?: number;
      isActive?: boolean;
    }
  ) {
    await this.getCategory(id);

    let slug = data.slug ? slugify(data.slug) : undefined;
    if (slug) {
      const existing = await menuRepository.findCategoryBySlug(slug);
      if (existing && existing.id !== id) {
        throw new AppError('Category slug already exists.', 409, 'DUPLICATE_SLUG');
      }
    } else if (data.name) {
      slug = slugify(data.name);
      const existing = await menuRepository.findCategoryBySlug(slug);
      if (existing && existing.id !== id) {
        throw new AppError('Category slug already exists.', 409, 'DUPLICATE_SLUG');
      }
    }

    const updated = await menuRepository.updateCategory(id, {
      name: data.name,
      slug,
      description: data.description,
    });

    await this.invalidateCache();
    return updated;
  }

  async deleteCategory(id: string) {
    await this.getCategory(id);
    const deleted = await menuRepository.softDeleteCategory(id);
    await this.invalidateCache();
    return deleted;
  }

  async listCategories(filters: { search?: string; page: number; limit: number }) {
    return menuRepository.listCategories(filters);
  }

  // ── MenuItem Service ──

  async createMenuItem(data: {
    categoryId: string;
    name: string;
    slug?: string;
    description: string;
    price: number;
    imageUrl?: string;
    tags?: string[] | string;
    isFeatured?: boolean;
    isActive?: boolean;
  }) {
    // Validate category existence
    const category = await menuRepository.findCategoryById(data.categoryId);
    if (!category) {
      throw new AppError('Invalid category ID.', 400, 'INVALID_CATEGORY');
    }

    const slug = data.slug ? slugify(data.slug) : slugify(data.name);

    // Verify unique slug
    const existing = await menuRepository.findMenuItemBySlug(slug);
    if (existing) {
      throw new AppError('Menu item slug already exists.', 409, 'DUPLICATE_SLUG');
    }

    // Map tags array to singular tag string inside DB
    let tagString: string | undefined = undefined;
    if (data.tags) {
      tagString = Array.isArray(data.tags) ? data.tags.join(', ') : data.tags;
    }

    const item = await menuRepository.createMenuItem({
      categoryId: data.categoryId,
      name: data.name,
      slug,
      description: data.description,
      price: new Decimal(data.price),
      image: data.imageUrl,
      tag: tagString,
      isActive: data.isActive !== undefined ? data.isActive : true,
      isFeatured: data.isFeatured !== undefined ? data.isFeatured : false,
      isDeleted: false,
    });

    await this.invalidateCache();
    return {
      ...item,
      tags: item.tag ? item.tag.split(', ') : [],
    };
  }

  async getMenuItem(id: string) {
    const item = await menuRepository.findMenuItemById(id);
    if (!item) {
      throw new AppError('Menu item not found.', 404, 'MENU_ITEM_NOT_FOUND');
    }
    return {
      ...item,
      tags: item.tag ? item.tag.split(', ') : [],
    };
  }

  async updateMenuItem(
    id: string,
    data: {
      categoryId?: string;
      name?: string;
      slug?: string;
      description?: string;
      price?: number;
      imageUrl?: string;
      tags?: string[] | string;
      isFeatured?: boolean;
      isActive?: boolean;
    }
  ) {
    await this.getMenuItem(id);

    if (data.categoryId) {
      const category = await menuRepository.findCategoryById(data.categoryId);
      if (!category) {
        throw new AppError('Invalid category ID.', 400, 'INVALID_CATEGORY');
      }
    }

    let slug = data.slug ? slugify(data.slug) : undefined;
    if (slug) {
      const existing = await menuRepository.findMenuItemBySlug(slug);
      if (existing && existing.id !== id) {
        throw new AppError('Menu item slug already exists.', 409, 'DUPLICATE_SLUG');
      }
    } else if (data.name) {
      slug = slugify(data.name);
      const existing = await menuRepository.findMenuItemBySlug(slug);
      if (existing && existing.id !== id) {
        throw new AppError('Menu item slug already exists.', 409, 'DUPLICATE_SLUG');
      }
    }

    let tagString: string | undefined = undefined;
    if (data.tags) {
      tagString = Array.isArray(data.tags) ? data.tags.join(', ') : data.tags;
    }

    const updated = await menuRepository.updateMenuItem(id, {
      categoryId: data.categoryId,
      name: data.name,
      slug,
      description: data.description,
      price: data.price !== undefined ? new Decimal(data.price) : undefined,
      image: data.imageUrl,
      tag: tagString,
      isActive: data.isActive,
      isFeatured: data.isFeatured,
    });

    await this.invalidateCache();
    return {
      ...updated,
      tags: updated.tag ? updated.tag.split(', ') : [],
    };
  }

  async deleteMenuItem(id: string) {
    await this.getMenuItem(id);
    const deleted = await menuRepository.softDeleteMenuItem(id);
    await this.invalidateCache();
    return deleted;
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
    const { items, total } = await menuRepository.listMenuItems(filters);
    const mapped = items.map((item) => ({
      ...item,
      tags: item.tag ? item.tag.split(', ') : [],
    }));
    return { items: mapped, total };
  }

  // ── Public APIs with Caching ──

  async getPublicMenu() {
    try {
      const redis = getRedisClient();
      const cached = await redis.get('menu:public:all');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Proceed to DB if Redis fails
    }

    const categories = await menuRepository.getPublicMenu();
    // Format response structure: group menu items by active category
    const activeCategories = categories
      .filter((cat) => cat.items.length > 0)
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        items: cat.items.map((item) => ({
          id: item.id,
          name: item.name,
          slug: item.slug,
          description: item.description,
          price: Number(item.price),
          image: item.image,
          tag: item.tag,
          tags: item.tag ? item.tag.split(', ') : [],
          isFeatured: item.isFeatured,
          isActive: item.isActive,
        })),
      }));

    const result = { categories: activeCategories };

    try {
      const redis = getRedisClient();
      await redis.set('menu:public:all', JSON.stringify(result), 'EX', this.cacheTTL);
    } catch {
      // Ignore cache write errors
    }

    return result;
  }

  async getPublicCategories() {
    try {
      const redis = getRedisClient();
      const cached = await redis.get('menu:public:categories');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Proceed to DB if Redis fails
    }

    const categories = await menuRepository.getPublicCategories();
    const result = { categories };

    try {
      const redis = getRedisClient();
      await redis.set(
        'menu:public:categories',
        JSON.stringify(result),
        'EX',
        this.cacheTTL
      );
    } catch {
      // Ignore cache write errors
    }

    return result;
  }

  async warmCache() {
    await Promise.all([this.getPublicMenu(), this.getPublicCategories()]);
  }
}

export const menuService = new MenuService();
