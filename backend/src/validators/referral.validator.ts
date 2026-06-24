import { z } from 'zod';

export const createReferralSchema = {
  body: z.object({
    referredUserId: z.string({ required_error: 'Referred user ID is required' }).uuid(),
  }),
};

export const referralQuerySchema = {
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
