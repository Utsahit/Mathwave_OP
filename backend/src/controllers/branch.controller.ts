import { Request, Response, NextFunction } from 'express';
import { branchService } from '../services/branch.service';
import { sendSuccess } from '../utils/response';

export class BranchController {
  createBranch = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const adminUserId = (req as any).user?.userId;
      const result = await branchService.createBranch(req.body, adminUserId);
      sendSuccess(res, 'Branch created successfully.', result, {}, 201);
    } catch (error) {
      next(error);
    }
  };

  updateBranch = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const adminUserId = (req as any).user?.userId;
      const result = await branchService.updateBranch(
        req.params.id,
        req.body,
        adminUserId
      );
      sendSuccess(res, 'Branch updated successfully.', result);
    } catch (error) {
      next(error);
    }
  };

  deleteBranch = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const adminUserId = (req as any).user?.userId;
      const result = await branchService.deleteBranch(req.params.id, adminUserId);
      sendSuccess(res, 'Branch deleted successfully.', result);
    } catch (error) {
      next(error);
    }
  };

  listBranches = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const search = req.query.search as string | undefined;
      const city = req.query.city as string | undefined;
      const state = req.query.state as string | undefined;
      const isActive =
        req.query.isActive === 'true'
          ? true
          : req.query.isActive === 'false'
            ? false
            : undefined;

      const result = await branchService.listBranches(page, limit, {
        search,
        city,
        state,
        isActive,
      });
      sendSuccess(res, 'Branches retrieved successfully.', result);
    } catch (error) {
      next(error);
    }
  };

  getBranch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await branchService.getBranch(req.params.id);
      sendSuccess(res, 'Branch retrieved successfully.', result);
    } catch (error) {
      next(error);
    }
  };
}

export const branchController = new BranchController();
