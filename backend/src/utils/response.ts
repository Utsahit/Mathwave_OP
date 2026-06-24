/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from 'express';

/**
 * Standardized success response structure
 */
export interface SuccessResponse<T = any> {
  success: true;
  message: string;
  data: T;
  meta: Record<string, any>;
}

/**
 * Standardized error response structure
 */
export interface ErrorResponse {
  success: false;
  message: string;
  errors: unknown[];
  code: string;
}

/**
 * Sends a standardized success JSON response
 */
export function sendSuccess<T = any>(
  res: Response,
  message: string,
  data: T = {} as T,
  meta: Record<string, any> = {},
  statusCode: number = 200
): Response {
  const body: SuccessResponse<T> = {
    success: true,
    message,
    data,
    meta,
  };
  return res.status(statusCode).json(body);
}

/**
 * Sends a standardized error JSON response
 */
export function sendError(
  res: Response,
  message: string,
  errors: unknown[] = [],
  code: string = 'BAD_REQUEST',
  statusCode: number = 400
): Response {
  const body: ErrorResponse = {
    success: false,
    message,
    errors,
    code,
  };
  return res.status(statusCode).json(body);
}
