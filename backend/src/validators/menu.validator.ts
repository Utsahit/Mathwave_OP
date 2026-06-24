import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required.').max(100),
  slug: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const updateCategorySchema = createCategorySchema.partial();

export const createMenuItemSchema = z.object({
  categoryId: z.string().uuid('Invalid Category ID format.'),
  name: z.string().min(1, 'Menu item name is required.').max(100),
  slug: z.string().max(100).optional(),
  description: z.string().min(1, 'Description is required.').max(1000),
  price: z.preprocess(
    (val) => Number(val),
    z.number().positive('Price must be positive.')
  ),
  imageUrl: z
    .string()
    .url('Invalid image URL.')
    .or(z.string().regex(/^\/uploads\/[a-zA-Z0-9_\-\.]+\.(png|jpg|jpeg|webp)$/))
    .optional(),
  tags: z.array(z.string()).or(z.string()).optional(),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const updateMenuItemSchema = createMenuItemSchema.partial();

export const menuQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  featured: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
  active: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
  sortBy: z.enum(['name', 'price', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('asc'),
  page: z.preprocess((val) => Number(val), z.number().int().positive().default(1)),
  limit: z.preprocess((val) => Number(val), z.number().int().positive().default(20)),
});
