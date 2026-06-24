import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/app-error';
import { getUserBranchIds, BranchScope, canAccessBranch } from '../utils/branch-scope';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      branchId?: string;
      branchScope?: BranchScope;
    }
  }
}

export async function branchContext(req: Request, _res: Response, next: NextFunction) {
  try {
    const branchId =
      (req.headers['x-branch-id'] as string | undefined) || req.params.branchId;

    const user = (req as any).user;
    if (user) {
      const role: string = user.roleName;
      if (role === 'ADMIN') {
        req.branchScope = null;
      } else if (role === 'MANAGER' || role === 'STAFF') {
        req.branchScope = await getUserBranchIds(user.userId);
      } else {
        req.branchScope = [];
      }
    }

    if (!branchId) {
      return next();
    }

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, isActive: true },
    });

    if (!branch) {
      throw new AppError('Branch not found.', 404, 'BRANCH_NOT_FOUND');
    }
    if (!branch.isActive) {
      throw new AppError('Branch is inactive.', 400, 'BRANCH_INACTIVE');
    }

    if (
      req.branchScope !== null &&
      req.branchScope !== undefined &&
      !canAccessBranch(req.branchScope, branch.id)
    ) {
      throw new AppError(
        'You do not have access to this branch.',
        403,
        'BRANCH_ACCESS_DENIED'
      );
    }

    req.branchId = branch.id;
    next();
  } catch (error) {
    next(error);
  }
}

export async function branchScopeMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const user = (req as any).user;
    if (!user) {
      req.branchScope = undefined;
      return next();
    }

    const role: string = user.roleName;
    if (role === 'ADMIN') {
      req.branchScope = null;
    } else if (role === 'MANAGER' || role === 'STAFF') {
      req.branchScope = await getUserBranchIds(user.userId);
    } else {
      req.branchScope = [];
    }

    next();
  } catch (error) {
    next(error);
  }
}
