import jwt from 'jsonwebtoken';
import { env } from '../config/env';

/**
 * Custom JWT Payload Structure matching Phase 4 specifications
 */
export interface JwtPayload {
  userId: string;
  email: string;
  roleName: string;
  jti: string;
  iss: string;
  aud: string;
  iat?: number;
  exp?: number;
}

const ISSUER = 'elixir-oak-backend';
const AUDIENCE = 'elixir-oak-client';

/**
 * Generates a short-lived 15-minute Access Token
 */
export function generateAccessToken(
  user: { userId: string; email: string; roleName: string },
  jti: string
): string {
  const payload = {
    userId: user.userId,
    email: user.email,
    roleName: user.roleName,
  };

  const options: jwt.SignOptions = {
    expiresIn: '15m',
    issuer: ISSUER,
    audience: AUDIENCE,
    jwtid: jti,
  };

  return jwt.sign(payload, env.JWT_SECRET, options);
}

/**
 * Generates a long-lived 7-day Refresh Token with an explicit JWT ID (jti)
 */
export function generateRefreshToken(
  user: { userId: string; email: string; roleName: string },
  jti: string
): string {
  const payload = {
    userId: user.userId,
    email: user.email,
    roleName: user.roleName,
  };

  const options: jwt.SignOptions = {
    expiresIn: '7d',
    issuer: ISSUER,
    audience: AUDIENCE,
    jwtid: jti,
  };

  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
}

/**
 * Verifies an Access Token and returns its payload
 */
export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE,
  }) as JwtPayload;
}

/**
 * Verifies a Refresh Token and returns its payload
 */
export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE,
  }) as JwtPayload;
}
