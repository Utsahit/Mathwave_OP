import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { segmentationService } from '../services/segmentation.service';
import { sendSuccess } from '../utils/response';
import { SegmentType } from '@prisma/client';

export class SegmentController {
  listSegments = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const segmentType = req.query.segment as SegmentType | undefined;
      const result = await segmentationService.listSegments(page, limit, segmentType);
      sendSuccess(res, 'Segments retrieved successfully.', result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  };

  recalculateSegments = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await segmentationService.recalculateAll();
      sendSuccess(res, 'Segments recalculated successfully.', result);
    } catch (err) {
      next(err);
    }
  };

  getSegmentStats = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const stats = await segmentationService.getSegmentStats();
      sendSuccess(res, 'Segment stats retrieved successfully.', stats);
    } catch (err) {
      next(err);
    }
  };

  getUserSegments = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const segments = await segmentationService.getUserSegments(req.user!.userId);
      sendSuccess(res, 'User segments retrieved successfully.', segments);
    } catch (err) {
      next(err);
    }
  };
}

export const segmentController = new SegmentController();
