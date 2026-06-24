import { z } from 'zod';

export const createGiftCardSchema = {
  body: z.object({
    code: z
      .string({ required_error: 'Gift card code is required' })
      .min(1)
      .max(50)
      .transform((v) => v.toUpperCase()),
    originalAmount: z
      .number({ required_error: 'Amount is required' })
      .positive('Amount must be positive'),
    expiresAt: z
      .string()
      .datetime()
      .transform((v) => new Date(v))
      .optional(),
  }),
};

export const updateGiftCardSchema = {
  body: z.object({
    isActive: z.boolean().optional(),
    expiresAt: z
      .string()
      .datetime()
      .transform((v) => new Date(v))
      .optional()
      .nullable(),
  }),
};

export const redeemGiftCardSchema = {
  body: z.object({
    code: z.string({ required_error: 'Gift card code is required' }).min(1).max(50),
    orderId: z.string({ required_error: 'Order ID is required' }).uuid(),
    amount: z
      .number({ required_error: 'Amount is required' })
      .positive('Amount must be positive'),
  }),
};

export const giftCardQuerySchema = {
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
