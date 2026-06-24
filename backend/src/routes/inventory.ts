import { Router } from 'express';
import { ingredientController } from '../controllers/ingredient.controller';
import { inventoryController } from '../controllers/inventory.controller';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createIngredientSchema,
  updateIngredientSchema,
  manualAdjustmentSchema,
} from '../validators/inventory.validator';

const router = Router();

// Stats & monitoring
router.get(
  '/stats',
  requireAuth(),
  requirePermission('ingredient:view'),
  inventoryController.getStats
);

router.get(
  '/low-stock',
  requireAuth(),
  requirePermission('ingredient:view'),
  inventoryController.getLowStock
);

router.get(
  '/movements',
  requireAuth(),
  requirePermission('ingredient:view'),
  inventoryController.listStockMovements
);

// Ingredients CRUD
router.post(
  '/ingredients',
  requireAuth(),
  requirePermission('ingredient:create'),
  validate({ body: createIngredientSchema }),
  ingredientController.createIngredient
);

router.get(
  '/ingredients',
  requireAuth(),
  requirePermission('ingredient:view'),
  ingredientController.listIngredients
);

router.get(
  '/ingredients/:id',
  requireAuth(),
  requirePermission('ingredient:view'),
  ingredientController.getIngredient
);

router.put(
  '/ingredients/:id',
  requireAuth(),
  requirePermission('ingredient:update'),
  validate({ body: updateIngredientSchema }),
  ingredientController.updateIngredient
);

router.delete(
  '/ingredients/:id',
  requireAuth(),
  requirePermission('ingredient:delete'),
  ingredientController.deleteIngredient
);

router.post(
  '/ingredients/:ingredientId/adjust',
  requireAuth(),
  requirePermission('ingredient:update'),
  validate({ body: manualAdjustmentSchema }),
  inventoryController.makeManualAdjustment
);

export default router;
