import { Request, Response, NextFunction } from 'express';
import { queueService } from '../services/queue.service';
import { sendSuccess } from '../utils/response';

export class JobsController {
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const status = req.query.status as string | undefined;
      const result = await queueService.list(page, pageSize, status);
      sendSuccess(res, 'Jobs retrieved successfully.', result.data, {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      });
    } catch (err) {
      next(err);
    }
  };

  retry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const job = await queueService.retryFailedJob(req.params.id);
      if (!job) {
        res
          .status(404)
          .json({ success: false, message: 'Job not found or not in FAILED status.' });
        return;
      }
      sendSuccess(res, 'Job retry initiated.', job);
    } catch (err) {
      next(err);
    }
  };

  getStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await queueService.getStats();
      sendSuccess(res, 'Job stats retrieved.', stats);
    } catch (err) {
      next(err);
    }
  };
}

export const jobsController = new JobsController();
