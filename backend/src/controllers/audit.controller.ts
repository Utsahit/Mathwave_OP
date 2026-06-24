import { Request, Response, NextFunction } from 'express';
import { auditService } from '../services/audit.service';
import { sendSuccess } from '../utils/response';

export class AuditController {
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const filters = {
        entityType: req.query.entityType as string | undefined,
        userId: req.query.userId as string | undefined,
        action: req.query.action as string | undefined,
      };
      const result = await auditService.list(page, pageSize, filters);
      sendSuccess(res, 'Audit logs retrieved successfully.', result.data, {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const auditController = new AuditController();
