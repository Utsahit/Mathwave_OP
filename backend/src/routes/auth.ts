import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { authLoginLimiter, authRegisterLimiter } from '../middleware/rate-limiter';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  changePasswordSchema,
} from '../validators/auth.validator';

const router = Router();
const controller = new AuthController();

/**
 * Public Authentication Routes
 */
router.post(
  '/register',
  authRegisterLimiter,
  validate(registerSchema),
  controller.register
);
router.post('/login', authLoginLimiter, validate(loginSchema), controller.login);
router.post('/refresh', validate(refreshSchema), controller.refresh);
router.post('/logout', validate(logoutSchema), controller.logout);

/**
 * Protected Authentication Routes
 */
router.post('/logout-all', requireAuth(), controller.logoutAll);
router.get('/me', requireAuth(), controller.me);
router.post(
  '/change-password',
  requireAuth(),
  validate(changePasswordSchema),
  controller.changePassword
);

export default router;
