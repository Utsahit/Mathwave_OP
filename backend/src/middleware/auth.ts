import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../utils/app-error';
import { prisma } from '../config/prisma';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    roleName: string;
  };
}

/**
 * Middleware ensuring a valid JWT Access Token is supplied in authorization header
 */
export function requireAuth() {
  return async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next(
        new AppError('Authentication token is missing or invalid.', 401, 'UNAUTHORIZED')
      );
      return;
    }

    const token = authHeader.split(' ')[1];
    try {
      const payload = verifyAccessToken(token);

      // Verify the session JTI still exists in the database
      const activeSession = await prisma.userSession.findUnique({
        where: { id: payload.jti },
      });

      if (!activeSession) {
        next(
          new AppError('Authentication session expired or invalid.', 401, 'UNAUTHORIZED')
        );
        return;
      }

      req.user = {
        userId: payload.userId,
        email: payload.email,
        roleName: payload.roleName,
      };
      next();
    } catch {
      next(
        new AppError('Authentication session expired or invalid.', 401, 'UNAUTHORIZED')
      );
    }
  };
}

/**
 * Middleware restricting access to specific Role names
 */
export function requireRole(allowedRole: string) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('Authentication session required.', 401, 'UNAUTHORIZED');
    }
    if (req.user.roleName !== allowedRole) {
      throw new AppError(
        'Access denied. Insufficient role clearances.',
        403,
        'FORBIDDEN'
      );
    }
    next();
  };
}

/**
 * Middleware restricting access by database-driven Permission strings
 */
export function requirePermission(allowedPermission: string) {
  return async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      throw new AppError('Authentication session required.', 401, 'UNAUTHORIZED');
    }

    try {
      // Query database live for permissions mapped to the user's role
      const roleRecord = await prisma.dbRole.findUnique({
        where: { name: req.user.roleName },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });

      if (!roleRecord) {
        throw new AppError('User role profile is invalid.', 403, 'FORBIDDEN');
      }

      const permissionStrings = roleRecord.permissions.map((rp) => rp.permission.name);
      if (!permissionStrings.includes(allowedPermission)) {
        throw new AppError(
          'Access denied. Insufficient system permissions.',
          403,
          'FORBIDDEN'
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
