import { Router } from 'express';
import { addressController } from '../controllers/address.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth(), addressController.listAddresses);
router.post('/', requireAuth(), addressController.createAddress);
router.put('/:id', requireAuth(), addressController.updateAddress);
router.delete('/:id', requireAuth(), addressController.deleteAddress);

export default router;
