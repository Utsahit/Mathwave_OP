import { Request, Response, NextFunction } from 'express';
import { reportService } from '../services/report.service';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/app-error';

export class ReportController {
  listScheduledReports = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const data = await reportService.listScheduledReports();
      sendSuccess(res, 'Scheduled reports retrieved successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  createScheduledReport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { name, email, frequency } = req.body;
      if (!name || !email || !frequency) {
        throw new AppError(
          'Name, email, and frequency are required.',
          400,
          'VALIDATION_ERROR'
        );
      }
      if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(frequency)) {
        throw new AppError(
          'Frequency must be DAILY, WEEKLY, or MONTHLY.',
          400,
          'VALIDATION_ERROR'
        );
      }
      const data = await reportService.createScheduledReport({ name, email, frequency });
      sendSuccess(res, 'Scheduled report created successfully.', data);
    } catch (err) {
      next(err);
    }
  };

  deleteScheduledReport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await reportService.deleteScheduledReport(req.params.id);
      sendSuccess(res, 'Scheduled report deleted successfully.');
    } catch (err) {
      next(err);
    }
  };

  exportCsv = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const type = req.query.type as string;
      if (!['revenue', 'orders', 'customers', 'inventory', 'branches'].includes(type)) {
        throw new AppError(
          'Invalid export type. Use: revenue, orders, customers, inventory, branches.',
          400,
          'VALIDATION_ERROR'
        );
      }
      const csv = await reportService.exportCsv(type as any);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}-export.csv"`);
      res.status(200).send(csv);
    } catch (err) {
      next(err);
    }
  };

  queuePdfExport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const type = (req.query.type as string) || 'executive-summary';
      const job = await reportService.queuePdfExport(type);
      sendSuccess(res, 'PDF export queued successfully.', { jobId: job.id, type });
    } catch (err) {
      next(err);
    }
  };
}

export const reportController = new ReportController();
