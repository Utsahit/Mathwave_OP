import { Router } from 'express';
import { auditController } from '../controllers/audit.controller';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth(), requirePermission('audit:view'), auditController.list);

export default router;
