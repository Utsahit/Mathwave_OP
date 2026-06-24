import { Router } from 'express';
import { favoritesController } from '../controllers/favorites.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth(), favoritesController.listFavorites);
router.post('/:menuItemId', requireAuth(), favoritesController.addFavorite);
router.delete('/:menuItemId', requireAuth(), favoritesController.removeFavorite);

export default router;
