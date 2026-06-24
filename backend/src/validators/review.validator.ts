import { z } from 'zod';

// ── Shared safe preprocess helpers ───────────────────────────────────────────
const safeNum = (val: unknown) =>
  val === undefined || val === '' ? undefined : Number(val);

// ── Public Review Submission ──────────────────────────────────────────────────
export const createReviewSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(100),
  email: z.string().email('Invalid email address.'),
  title: z.string().min(3, 'Title must be at least 3 characters.').max(120).optional(),
  rating: z
    .number()
    .int()
    .min(1, 'Rating must be between 1 and 5.')
    .max(5, 'Rating must be between 1 and 5.'),
  comment: z
    .string()
    .min(10, 'Review comment must be at least 10 characters.')
    .max(1000, 'Review comment cannot exceed 1000 characters.'),
});

// ── Admin Update Review ───────────────────────────────────────────────────────
export const updateReviewSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  title: z.string().min(3).max(120).optional(),
  comment: z.string().min(10).max(1000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

// ── Admin Query ───────────────────────────────────────────────────────────────
export const adminReviewQuerySchema = z.object({
  isApproved: z
    .preprocess(
      (val) => (val === undefined ? undefined : val === 'true' || val === true),
      z.boolean().optional()
    )
    .optional(),
  isFeatured: z
    .preprocess(
      (val) => (val === undefined ? undefined : val === 'true' || val === true),
      z.boolean().optional()
    )
    .optional(),
  rating: z.preprocess(safeNum, z.number().int().min(1).max(5).optional()),
  search: z.string().optional(),
  page: z.preprocess(safeNum, z.number().int().positive().default(1)),
  limit: z.preprocess(safeNum, z.number().int().positive().default(20)),
});

// ── Public Query ──────────────────────────────────────────────────────────────
export const publicReviewQuerySchema = z.object({
  rating: z.preprocess(safeNum, z.number().int().min(1).max(5).optional()),
  page: z.preprocess(safeNum, z.number().int().positive().default(1)),
  limit: z.preprocess(safeNum, z.number().int().positive().default(10)),
});
