import { Request, Response, NextFunction } from 'express';
import { franchiseService } from '../services/franchise.service';
import { AppError } from '../utils/app-error';
import { sendSuccess } from '../utils/response';

export class FranchiseController {
  createFranchise = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const adminUserId = (req as any).user?.userId;
      if (!adminUserId) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }
      const result = await franchiseService.createFranchise(req.body, adminUserId);
      sendSuccess(res, 'Franchise created successfully.', result, {}, 201);
    } catch (error) {
      next(error);
    }
  };

  updateFranchise = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const adminUserId = (req as any).user?.userId;
      if (!adminUserId) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }
      const result = await franchiseService.updateFranchise(
        req.params.id,
        req.body,
        adminUserId
      );
      sendSuccess(res, 'Franchise updated successfully.', result);
    } catch (error) {
      next(error);
    }
  };

  listFranchises = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await franchiseService.listFranchises(page, limit);
      sendSuccess(res, 'Franchises retrieved successfully.', result);
    } catch (error) {
      next(error);
    }
  };

  assignBranch = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const adminUserId = (req as any).user?.userId;
      if (!adminUserId) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }
      const { franchiseId, branchId } = req.body;
      const result = await franchiseService.assignBranch(
        franchiseId,
        branchId,
        adminUserId
      );
      sendSuccess(res, 'Branch assigned to franchise successfully.', result);
    } catch (error) {
      next(error);
    }
  };

  removeBranch = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const adminUserId = (req as any).user?.userId;
      if (!adminUserId) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }
      const result = await franchiseService.removeBranch(req.params.id, adminUserId);
      sendSuccess(res, 'Branch removed from franchise successfully.', result);
    } catch (error) {
      next(error);
    }
  };
}

export const franchiseController = new FranchiseController();
