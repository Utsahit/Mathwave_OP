import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error';
import { sendError } from '../utils/response';
import logger from '../config/logger';
import { env } from '../config/env';

/**
 * Global Express Error Handling Middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Handled Operational Application Errors
  if (err instanceof AppError) {
    logger.warn(
      {
        code: err.code,
        status: err.statusCode,
        errors: err.errors,
        message: err.message,
      },
      'AppError caught'
    );
    sendError(res, err.message, err.errors, err.code, err.statusCode);
    return;
  }

  // 2. Schema Validation Errors (Zod)
  if (err instanceof ZodError) {
    const validationErrors = err.errors.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    logger.warn({ errors: validationErrors }, 'Zod schema validation failed');
    sendError(
      res,
      'Request validation failed',
      validationErrors,
      'VALIDATION_ERROR',
      400
    );
    return;
  }

  // 3. Database Errors (Prisma Client Known Failures)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.error(
      { prismaCode: err.code, meta: err.meta, message: err.message },
      'Prisma client error'
    );
    switch (err.code) {
      case 'P2002': {
        const fields = (err.meta?.target as string[]) || [];
        sendError(
          res,
          `Record conflict on unique field(s): ${fields.join(', ')}`,
          [],
          'CONFLICT_ERROR',
          409
        );
        return;
      }
      case 'P2025':
        sendError(res, 'The requested record was not found.', [], 'NOT_FOUND', 404);
        return;
      case 'P2003':
        sendError(
          res,
          'Foreign key constraint violation. Referenced record does not exist.',
          [],
          'FOREIGN_KEY_VIOLATION',
          400
        );
        return;
      default:
        sendError(
          res,
          'A database error occurred during execution.',
          [],
          'DATABASE_ERROR',
          500
        );
        return;
    }
  }

  // 4. Fallback: Unexpected Server-side Errors
  logger.error(
    {
      err: {
        message: err.message,
        stack: err.stack,
      },
      path: req.path,
      method: req.method,
    },
    'Unhandled server error occurred'
  );

  const responseMessage =
    env.NODE_ENV === 'production' ? 'Internal server error occurred.' : err.message;

  const responseErrors = env.NODE_ENV === 'production' ? [] : [err.stack];

  sendError(res, responseMessage, responseErrors, 'INTERNAL_SERVER_ERROR', 500);
}

export default errorHandler;
