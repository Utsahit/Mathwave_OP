import { z } from 'zod';

/**
 * Validator schema for POST /api/v1/auth/register
 */
export const registerSchema = {
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email format')
      .trim(),
    password: z
      .string({ required_error: 'Password is required' })
      .min(8, 'Password must be at least 8 characters long')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character'),
    name: z
      .string({ required_error: 'Name is required' })
      .trim()
      .min(2, 'Name must be at least 2 characters long'),
  }),
};

/**
 * Validator schema for POST /api/v1/auth/login
 */
export const loginSchema = {
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email format')
      .trim(),
    password: z.string({ required_error: 'Password is required' }),
  }),
};

/**
 * Validator schema for POST /api/v1/auth/refresh
 */
export const refreshSchema = {
  body: z.object({
    refreshToken: z.string({ required_error: 'Refresh token is required' }),
  }),
};

/**
 * Validator schema for POST /api/v1/auth/logout
 */
export const logoutSchema = {
  body: z.object({
    refreshToken: z.string({ required_error: 'Refresh token is required' }),
  }),
};

/**
 * Validator schema for POST /api/v1/auth/change-password
 */
export const changePasswordSchema = {
  body: z.object({
    oldPassword: z.string({ required_error: 'Old password is required' }),
    newPassword: z
      .string({ required_error: 'New password is required' })
      .min(8, 'New password must be at least 8 characters long')
      .regex(/[a-z]/, 'New password must contain at least one lowercase letter')
      .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'New password must contain at least one number')
      .regex(/[^a-zA-Z0-9]/, 'New password must contain at least one special character'),
  }),
};
