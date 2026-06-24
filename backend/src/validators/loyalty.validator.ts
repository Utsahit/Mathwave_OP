import { z } from 'zod';

export const redeemPointsSchema = {
  body: z.object({
    points: z
      .number({ required_error: 'Points are required' })
      .int()
      .positive('Points must be positive'),
    orderId: z.string().uuid().optional(),
  }),
};

export const adjustPointsSchema = {
  body: z.object({
    userId: z.string({ required_error: 'User ID is required' }).uuid(),
    points: z
      .number({ required_error: 'Points are required' })
      .int('Points must be an integer'),
    description: z.string({ required_error: 'Description is required' }).min(1).max(500),
  }),
};

export const loyaltyHistoryQuerySchema = {
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
