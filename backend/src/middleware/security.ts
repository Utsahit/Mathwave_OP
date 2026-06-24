import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import helmet from 'helmet';
import express, { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Global rate-limiting parameters (IP-based protection)
 */
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      'Too many requests originating from this IP address. Please retry after 15 minutes.',
    errors: [],
    code: 'TOO_MANY_REQUESTS',
  },
});

/**
 * Central CORS configuration settings
 */
export const corsConfiguration = cors({
  origin:
    env.NODE_ENV === 'production' ? (process.env.CORS_ORIGIN || '').split(',') : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
});

/**
 * Generates a cryptographically random nonce per-request
 * for Content-Security-Policy nonce-based script/style restrictions.
 * Must be registered before secureHeaders in the middleware chain.
 */
export function nonceMiddleware(_req: Request, res: Response, next: NextFunction) {
  res.locals.cspNonce = crypto.randomBytes(16).toString('hex');
  next();
}

/**
 * Helmet middleware wrapper for security header sanitization
 * Enables HSTS with 1-year maxAge, includeSubDomains, and preload for production
 * Enables nonce-based Content-Security-Policy for XSS mitigation
 */
export const secureHeaders = helmet({
  hsts:
    env.NODE_ENV === 'production'
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : { maxAge: 31536000, includeSubDomains: true },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        (_req, res) => `'nonce-${(res as unknown as Response).locals.cspNonce}'`,
      ],
      styleSrc: [
        "'self'",
        (_req, res) => `'nonce-${(res as unknown as Response).locals.cspNonce}'`,
      ],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https:'],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
});

/**
 * Permissions-Policy header to restrict browser API access
 * (not included in helmet v7, so set manually)
 */
export function permissionsPolicy(_req: Request, res: Response, next: NextFunction) {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(self), usb=(), magnetometer=(), accelerometer=(), gyroscope=(), midi=(), sync-xhr=(), fullscreen=(self)'
  );
  next();
}

/**
 * Content-Security-Policy override for Swagger UI routes.
 * Swagger UI injects inline scripts/styles that do not carry a nonce,
 * so the policy is relaxed to allow 'unsafe-inline' and 'unsafe-eval'.
 */
export function swaggerCspOverride(_req: Request, res: Response, next: NextFunction) {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'"
  );
  next();
}

/**
 * Express Request parser size limit settings
 */
export const jsonBodyParser = express.json({ limit: '10mb' });
export const urlencodedBodyParser = express.urlencoded({ extended: true, limit: '10mb' });
