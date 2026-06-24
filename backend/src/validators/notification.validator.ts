import { z } from 'zod';

export const updateNotificationPreferencesBodySchema = z.object({
  orderUpdates: z.boolean().optional(),
  reservationUpdates: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
});
