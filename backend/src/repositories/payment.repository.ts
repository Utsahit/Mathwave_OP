import { prisma } from '../config/prisma';
import { Prisma, PaymentStatus } from '@prisma/client';

const TRANSACTION_SELECT = {
  id: true,
  orderId: true,
  razorpayOrderId: true,
  razorpayPaymentId: true,
  amount: true,
  status: true,
  gatewayResponse: true,
  verifiedAt: true,
  createdAt: true,
} satisfies Prisma.TransactionSelect;

export class PaymentRepository {
  async createTransaction(data: {
    orderId: string;
    razorpayOrderId?: string;
    amount: Prisma.Decimal | number;
    status?: PaymentStatus;
  }) {
    return prisma.transaction.create({
      data: {
        orderId: data.orderId,
        razorpayOrderId: data.razorpayOrderId,
        amount: data.amount,
        status: data.status || PaymentStatus.CREATED,
      },
      select: TRANSACTION_SELECT,
    });
  }

  async findTransactionById(id: string) {
    return prisma.transaction.findUnique({
      where: { id },
      select: TRANSACTION_SELECT,
    });
  }

  async findTransactionByRazorpayOrderId(razorpayOrderId: string) {
    return prisma.transaction.findUnique({
      where: { razorpayOrderId },
      select: TRANSACTION_SELECT,
    });
  }

  async updateTransactionStatus(
    id: string,
    status: PaymentStatus,
    razorpayPaymentId?: string | null,
    gatewayResponse?: unknown,
    razorpayOrderId?: string | null
  ) {
    return prisma.transaction.update({
      where: { id },
      data: {
        status,
        razorpayPaymentId,
        razorpayOrderId: razorpayOrderId ?? undefined,
        gatewayResponse: (gatewayResponse as Prisma.InputJsonValue) || undefined,
        verifiedAt: status === PaymentStatus.PAID ? new Date() : undefined,
      },
      select: TRANSACTION_SELECT,
    });
  }

  async isOrderAlreadyPaid(orderId: string): Promise<boolean> {
    const paidTx = await prisma.transaction.findFirst({
      where: {
        orderId,
        status: PaymentStatus.PAID,
      },
      select: { id: true },
    });
    return !!paidTx;
  }

  // ── Webhook Event Idempotency ────────────────────────────────────────────────

  async findWebhookEvent(_provider: string, eventId: string) {
    return prisma.webhookEvent.findUnique({
      where: { eventId },
      select: {
        id: true,
        provider: true,
        eventId: true,
        eventType: true,
        processedAt: true,
      },
    });
  }

  async createWebhookEvent(provider: string, eventId: string, eventType: string) {
    return prisma.webhookEvent.create({
      data: {
        provider,
        eventId,
        eventType,
      },
      select: {
        id: true,
        provider: true,
        eventId: true,
        eventType: true,
        processedAt: true,
      },
    });
  }
}

export const paymentRepository = new PaymentRepository();
