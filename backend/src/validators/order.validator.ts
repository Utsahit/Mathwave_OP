import { z } from 'zod';

const safeNum = (val: unknown) =>
  val === undefined || val === '' ? undefined : Number(val);

export const addCartItemSchema = z.object({
  menuItemId: z.string().uuid('Invalid menu item ID format.'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1.'),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1, 'Quantity must be at least 1.'),
});

export const createOrderSchema = z.object({
  cartId: z.string().uuid('Invalid cart ID format.'),
  customerName: z
    .string()
    .min(2, 'Customer name must be at least 2 characters.')
    .max(100),
  customerEmail: z.string().email('Invalid customer email address.'),
  customerPhone: z.string().min(10, 'Customer phone must be at least 10 digits.').max(15),
  reservationId: z.string().uuid('Invalid reservation ID format.').optional(),
});

export const paymentVerifySchema = z.object({
  orderId: z.string().uuid('Invalid order ID format.'),
  razorpayOrderId: z.string().min(1, 'Razorpay order ID is required.'),
  razorpayPaymentId: z.string().min(1, 'Razorpay payment ID is required.'),
  razorpaySignature: z.string().min(1, 'Razorpay signature is required.'),
});

export const orderQuerySchema = z.object({
  status: z
    .enum([
      'PENDING',
      'CONFIRMED',
      'PREPARING',
      'READY',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
    ])
    .optional(),
  search: z.string().optional(),
  page: z.preprocess(safeNum, z.number().int().positive().default(1)),
  limit: z.preprocess(safeNum, z.number().int().positive().default(20)),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'PREPARING',
    'READY',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
  ]),
});
