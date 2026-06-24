import { Request, Response, NextFunction } from 'express';
import { branchStaffService } from '../services/branch-staff.service';
import { AppError } from '../utils/app-error';
import { sendSuccess } from '../utils/response';

export class BranchStaffController {
  assignStaff = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const adminUserId = (req as any).user?.userId;
      if (!adminUserId) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }
      const { branchId, userId } = req.body;
      const result = await branchStaffService.assignStaff(branchId, userId, adminUserId);
      sendSuccess(res, 'Staff assigned to branch successfully.', result, {}, 201);
    } catch (error) {
      next(error);
    }
  };

  removeStaff = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const adminUserId = (req as any).user?.userId;
      if (!adminUserId) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }
      const { branchId, userId } = req.params;
      const result = await branchStaffService.removeStaff(branchId, userId, adminUserId);
      sendSuccess(res, 'Staff removed from branch successfully.', result);
    } catch (error) {
      next(error);
    }
  };

  listStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const { data, total } = await branchStaffService.listStaff(
        req.params.branchId,
        page,
        limit
      );
      sendSuccess(res, 'Branch staff retrieved successfully.', data, {
        page,
        limit,
        total,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const branchStaffController = new BranchStaffController();
