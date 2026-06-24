import { Router } from 'express';
import { supplierController } from '../controllers/supplier.controller';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createSupplierSchema,
  updateSupplierSchema,
  addSupplierIngredientSchema,
} from '../validators/inventory.validator';

const router = Router();

router.post(
  '/',
  requireAuth(),
  requirePermission('supplier:create'),
  validate({ body: createSupplierSchema }),
  supplierController.createSupplier
);

router.get(
  '/',
  requireAuth(),
  requirePermission('supplier:view'),
  supplierController.listSuppliers
);

router.get(
  '/:id',
  requireAuth(),
  requirePermission('supplier:view'),
  supplierController.getSupplier
);

router.put(
  '/:id',
  requireAuth(),
  requirePermission('supplier:update'),
  validate({ body: updateSupplierSchema }),
  supplierController.updateSupplier
);

router.delete(
  '/:id',
  requireAuth(),
  requirePermission('supplier:delete'),
  supplierController.deleteSupplier
);

// Supplier-Ingredient mappings
router.post(
  '/:id/ingredients',
  requireAuth(),
  requirePermission('supplier:update'),
  validate({ body: addSupplierIngredientSchema }),
  supplierController.addOrUpdateIngredient
);

router.delete(
  '/:id/ingredients/:ingredientId',
  requireAuth(),
  requirePermission('supplier:update'),
  supplierController.removeIngredient
);

router.get(
  '/:id/ingredients',
  requireAuth(),
  requirePermission('supplier:view'),
  supplierController.listSupplierIngredients
);

export default router;
