import { z } from 'zod';

const safeNum = (val: unknown) =>
  val === undefined || val === '' ? undefined : Number(val);

export const createContactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(100),
  email: z.string().email('Invalid email address.'),
  subject: z.string().min(3, 'Subject must be at least 3 characters.').max(200),
  message: z.string().min(10, 'Message must be at least 10 characters.').max(2000),
});

export const createNewsletterSchema = z.object({
  email: z.string().email('Invalid email address.'),
});

export const unsubscribeSchema = z.object({
  email: z.string().email('Invalid email address.'),
});

export const contactQuerySchema = z.object({
  isRead: z
    .preprocess(
      (val) => (val === undefined ? undefined : val === 'true' || val === true),
      z.boolean().optional()
    )
    .optional(),
  search: z.string().optional(),
  page: z.preprocess(safeNum, z.number().int().positive().default(1)),
  limit: z.preprocess(safeNum, z.number().int().positive().default(20)),
  sortBy: z.enum(['createdAt', 'email']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const newsletterQuerySchema = z.object({
  isActive: z
    .preprocess(
      (val) => (val === undefined ? undefined : val === 'true' || val === true),
      z.boolean().optional()
    )
    .optional(),
  search: z.string().optional(),
  page: z.preprocess(safeNum, z.number().int().positive().default(1)),
  limit: z.preprocess(safeNum, z.number().int().positive().default(20)),
});
