import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { getRedisClient } from '../config/redis';
import { Request } from 'express';
import { env } from '../config/env';

type RateLimitConfig = {
  windowMs: number;
  max: number;
  message?: string;
};

function createLimiter({ windowMs, max, message }: RateLimitConfig) {
  const client = getRedisClient();
  const effectiveMax = env.NODE_ENV === 'test' ? 999999 : max;
  return rateLimit({
    windowMs,
    max: effectiveMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: message || `Too many requests. Please try again later.`,
      errors: [],
      code: 'TOO_MANY_REQUESTS',
    },
    store:
      client.status === 'ready'
        ? new (RedisStore as any)({
            prefix: `rl:`,
            sendCommand: (...args: string[]) =>
              (client.call as (...a: string[]) => any)(...args),
          })
        : undefined,
    keyGenerator: (req: Request) => {
      return ipKeyGenerator(
        req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown'
      );
    },
  });
}

export const authLoginLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many login attempts. Try again in 1 minute.',
});

export const authRegisterLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many registration attempts. Try again in 1 hour.',
});

export const contactLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Too many contact submissions. Try again in 1 hour.',
});

export const reviewLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Too many review submissions. Try again in 1 hour.',
});

export const newsletterLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many newsletter subscriptions. Try again in 1 hour.',
});

export const reservationLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many reservation attempts. Try again in 1 hour.',
});

export const paymentLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many payment attempts. Try again in 1 minute.',
});

export const adminLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many admin requests. Try again in 1 minute.',
});
