import { z } from 'zod';

export const createIngredientSchema = z.object({
  name: z.string().min(1, 'Name is required.').max(100),
  sku: z.string().max(50).optional().nullable(),
  unit: z.string().min(1, 'Unit is required.').max(20),
  currentStock: z.number().nonnegative('Stock cannot be negative.'),
  minimumStock: z.number().nonnegative('Minimum stock cannot be negative.'),
  costPerUnit: z.number().positive('Cost per unit must be greater than 0.'),
});

export const updateIngredientSchema = createIngredientSchema.partial();

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Name is required.').max(100),
  email: z.string().email('Invalid email.').optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(250).optional().nullable(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export const addSupplierIngredientSchema = z.object({
  ingredientId: z.string().uuid('Invalid ingredient ID format.'),
  pricePerUnit: z.number().positive('Price per unit must be greater than 0.'),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID format.'),
  items: z
    .array(
      z.object({
        ingredientId: z.string().uuid('Invalid ingredient ID format.'),
        quantity: z.number().positive('Quantity must be greater than 0.'),
        unitCost: z.number().positive('Unit cost must be greater than 0.'),
      })
    )
    .min(1, 'Purchase order must have at least 1 item.'),
});

export const updatePurchaseOrderStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'RECEIVED', 'CANCELLED']),
});

export const manualAdjustmentSchema = z.object({
  quantity: z.number({ required_error: 'Quantity is required.' }),
  comment: z.string().max(250).optional(),
});
