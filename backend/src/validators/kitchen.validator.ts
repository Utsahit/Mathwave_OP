import { z } from 'zod';
import { TicketPriority } from '@prisma/client';

const ticketPriorityValues = Object.values(TicketPriority) as [string, ...string[]];

export const updateTicketPrioritySchema = z.object({
  priority: z.enum(ticketPriorityValues),
});

export const assignStationSchema = z.object({
  stationId: z.string().uuid(),
});
