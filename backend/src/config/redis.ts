import Redis from 'ioredis';
import logger from './logger';
import { env } from './env';

let redis: Redis | null = null;

/**
 * Returns the singleton Redis instance
 */
export function getRedisClient(): Redis {
  if (!redis) {
    const isProduction = env.NODE_ENV === 'production';
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ to run background tasks reliably
      ...(isProduction && !env.REDIS_URL.startsWith('rediss://') ? { tls: {} } : {}),
      retryStrategy(times) {
        // Exponential backoff strategy, cap delay at 3 seconds
        const delay = Math.min(times * 100, 3000);
        logger.warn(
          { attempt: times, delay },
          'Redis connection lost. Retrying reconnection...'
        );
        return delay;
      },
    });

    redis.on('connect', () => {
      logger.info('Redis client initiating connection...');
    });

    redis.on('ready', () => {
      logger.info('✅ Connection to Redis verified successfully.');
    });

    redis.on('error', (err) => {
      logger.error({ err }, 'Redis connection error.');
    });

    redis.on('close', () => {
      logger.warn('Redis connection closed.');
    });
  }
  return redis;
}

/**
 * Verifies Redis connection on startup
 */
export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  if (client.status === 'ready') {
    return;
  }
  return new Promise<void>((resolve, reject) => {
    const handleReady = () => {
      client.off('error', handleError);
      resolve();
    };
    const handleError = (err: unknown) => {
      client.off('ready', handleReady);
      reject(err);
    };
    client.once('ready', handleReady);
    client.once('error', handleError);
  });
}

/**
 * Gracefully disconnects the Redis client during shutdown
 */
export async function disconnectRedis(): Promise<void> {
  if (redis) {
    try {
      await redis.quit();
      logger.info('Redis connection closed cleanly.');
      redis = null;
    } catch (error) {
      logger.error({ error }, 'Error while closing Redis connection.');
    }
  }
}

export default getRedisClient;
