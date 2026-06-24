import { Router } from 'express';
import { mobileController } from '../controllers/mobile.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/dashboard', requireAuth(), mobileController.getDashboard);
router.get('/profile', requireAuth(), mobileController.getProfile);
router.get('/orders', requireAuth(), mobileController.getOrders);
router.get('/reservations', requireAuth(), mobileController.getReservations);

export default router;
