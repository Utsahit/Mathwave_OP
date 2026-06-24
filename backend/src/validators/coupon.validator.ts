import { z } from 'zod';
import { CouponType } from '@prisma/client';

export const createCouponSchema = {
  body: z.object({
    code: z
      .string({ required_error: 'Coupon code is required' })
      .min(1)
      .max(50)
      .transform((v) => v.toUpperCase()),
    type: z.nativeEnum(CouponType),
    value: z
      .number({ required_error: 'Value is required' })
      .positive('Value must be positive'),
    minimumOrderValue: z.number().positive().optional(),
    maxDiscount: z.number().positive().optional(),
    usageLimit: z.number().int().positive().optional(),
    startsAt: z
      .string({ required_error: 'Start date is required' })
      .datetime()
      .transform((v) => new Date(v)),
    expiresAt: z
      .string({ required_error: 'Expiry date is required' })
      .datetime()
      .transform((v) => new Date(v)),
  }),
};

export const updateCouponSchema = {
  body: z.object({
    type: z.nativeEnum(CouponType).optional(),
    value: z.number().positive().optional(),
    minimumOrderValue: z.number().positive().optional().nullable(),
    maxDiscount: z.number().positive().optional().nullable(),
    usageLimit: z.number().int().positive().optional().nullable(),
    startsAt: z
      .string()
      .datetime()
      .transform((v) => new Date(v))
      .optional(),
    expiresAt: z
      .string()
      .datetime()
      .transform((v) => new Date(v))
      .optional(),
    isActive: z.boolean().optional(),
  }),
};

export const validateCouponSchema = {
  body: z.object({
    code: z.string({ required_error: 'Coupon code is required' }).min(1).max(50),
    orderValue: z.number({ required_error: 'Order value is required' }).positive(),
  }),
};

export const applyCouponSchema = {
  body: z.object({
    code: z.string({ required_error: 'Coupon code is required' }).min(1).max(50),
    orderId: z.string({ required_error: 'Order ID is required' }).uuid(),
    orderValue: z.number({ required_error: 'Order value is required' }).positive(),
  }),
};

export const couponQuerySchema = {
  query: z.object({
    page: z.preprocess(
      (val) => (val === undefined || val === '' ? 1 : Number(val)),
      z.number().int().positive()
    ),
    limit: z.preprocess(
      (val) => (val === undefined || val === '' ? 20 : Number(val)),
      z.number().int().positive()
    ),
  }),
};
