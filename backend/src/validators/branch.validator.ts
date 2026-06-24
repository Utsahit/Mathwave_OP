import { z } from 'zod';

export const createBranchSchema = {
  body: z.object({
    code: z.string().min(1).max(20),
    name: z.string().min(1).max(100),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    country: z.string().min(1),
    postalCode: z.string().optional(),
    timezone: z.string().min(1),
    franchiseId: z.string().uuid().optional(),
  }),
};

export const updateBranchSchema = {
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().min(1).optional(),
    city: z.string().min(1).optional(),
    state: z.string().min(1).optional(),
    country: z.string().min(1).optional(),
    postalCode: z.string().optional().nullable(),
    timezone: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
  }),
};

export const branchQuerySchema = {
  query: z.object({
    page: z.preprocess(
      (val) => (val === undefined || val === '' ? 1 : Number(val)),
      z.number().int().positive()
    ),
    limit: z.preprocess(
      (val) => (val === undefined || val === '' ? 20 : Number(val)),
      z.number().int().positive()
    ),
    search: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    isActive: z.preprocess(
      (val) => (val === 'true' ? true : val === 'false' ? false : undefined),
      z.boolean().optional()
    ),
  }),
};

export const createFranchiseSchema = {
  body: z.object({
    code: z.string().min(1).max(20),
    name: z.string().min(1).max(100),
    ownerName: z.string().min(1),
    ownerEmail: z.string().email(),
  }),
};

export const updateFranchiseSchema = {
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    ownerName: z.string().min(1).optional(),
    ownerEmail: z.string().email().optional(),
    isActive: z.boolean().optional(),
  }),
};

export const assignBranchSchema = {
  body: z.object({
    franchiseId: z.string().uuid(),
    branchId: z.string().uuid(),
  }),
};

export const assignStaffSchema = {
  body: z.object({
    branchId: z.string().uuid(),
    userId: z.string().uuid(),
  }),
};

export const createTransferSchema = {
  body: z.object({
    fromBranchId: z.string().uuid(),
    toBranchId: z.string().uuid(),
    items: z
      .array(
        z.object({
          ingredientId: z.string().uuid(),
          quantity: z.number().positive(),
        })
      )
      .min(1),
  }),
};

export const transferQuerySchema = {
  query: z.object({
    page: z.preprocess(
      (val) => (val === undefined || val === '' ? 1 : Number(val)),
      z.number().int().positive()
    ),
    limit: z.preprocess(
      (val) => (val === undefined || val === '' ? 20 : Number(val)),
      z.number().int().positive()
    ),
    status: z.string().optional(),
  }),
};
