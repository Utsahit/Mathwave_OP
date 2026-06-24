import { Router } from 'express';
import { recommendationController } from '../controllers/recommendation.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth(), recommendationController.getRecommendations);

export default router;
