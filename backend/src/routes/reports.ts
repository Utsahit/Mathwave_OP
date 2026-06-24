import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();

router.use(requireAuth());

router.get('/', requirePermission('report:view'), reportController.listScheduledReports);

router.post(
  '/',
  requirePermission('report:create'),
  reportController.createScheduledReport
);

router.delete(
  '/:id',
  requirePermission('report:delete'),
  reportController.deleteScheduledReport
);

router.get(
  '/export/csv',
  requirePermission('analytics:export'),
  reportController.exportCsv
);

router.get(
  '/export/pdf',
  requirePermission('analytics:export'),
  reportController.queuePdfExport
);

export default router;
