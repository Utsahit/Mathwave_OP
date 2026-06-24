import { prisma } from '../config/prisma';
import { SupportTicketStatus } from '@prisma/client';
import { AppError } from '../utils/app-error';
import { auditService } from './audit.service';

const ALLOWED_TRANSITIONS: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

export class SupportTicketService {
  async create(userId: string | undefined, data: { subject: string; message: string }) {
    const ticket = await prisma.supportTicket.create({
      data: {
        userId: userId || null,
        subject: data.subject,
        message: data.message,
      },
    });

    if (userId) {
      auditService
        .logCreate(null, 'SupportTicket', ticket.id, { subject: data.subject })
        .catch(() => {});
    }

    return ticket;
  }

  async listMyTickets(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          subject: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.supportTicket.count({ where: { userId } }),
    ]);
    return { data: items, total, page, limit };
  }

  async adminList(page: number, limit: number, status?: SupportTicketStatus) {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          subject: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          userId: true,
        },
      }),
      prisma.supportTicket.count({ where }),
    ]);
    return { data: items, total, page, limit };
  }

  async updateStatus(id: string, newStatus: SupportTicketStatus) {
    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new AppError('Support ticket not found.', 404, 'TICKET_NOT_FOUND');

    const allowed = ALLOWED_TRANSITIONS[ticket.status];
    if (!allowed.includes(newStatus)) {
      throw new AppError(
        `Invalid status transition: ${ticket.status} -> ${newStatus}.`,
        422,
        'INVALID_TRANSITION'
      );
    }

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: { status: newStatus },
    });

    auditService
      .logStatusChange(null, 'SupportTicket', id, ticket.status, newStatus)
      .catch(() => {});

    return updated;
  }
}

export const supportTicketService = new SupportTicketService();
