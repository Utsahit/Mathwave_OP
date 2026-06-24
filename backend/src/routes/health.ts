import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { getRedisClient } from '../config/redis';
import { sendSuccess, sendError } from '../utils/response';
import logger from '../config/logger';

const router = Router();

/**
 * GET /health
 * Basic liveness check probe
 */
router.get('/health', (_req: Request, res: Response) => {
  sendSuccess(res, 'Application is running.', {
    status: 'healthy',
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /ready
 * Readiness check probe verifying PostgreSQL and Redis reachability
 */
router.get('/ready', async (_req: Request, res: Response) => {
  let databaseStatus = 'disconnected';
  let redisStatus = 'disconnected';
  let overallReady = true;

  // 1. Verify PostgreSQL Database connection
  try {
    await prisma.$queryRaw`SELECT 1;`;
    databaseStatus = 'connected';
  } catch (error) {
    logger.error({ error }, 'Database ready probe failure.');
    databaseStatus = 'disconnected';
    overallReady = false;
  }

  // 2. Verify Redis Connection
  try {
    const redis = getRedisClient();
    if (redis.status === 'ready') {
      redisStatus = 'connected';
    } else {
      redisStatus = 'disconnected';
      overallReady = false;
    }
  } catch (error) {
    logger.error({ error }, 'Redis ready probe failure.');
    redisStatus = 'disconnected';
    overallReady = false;
  }

  const statusPayload = {
    status: overallReady ? 'healthy' : 'unhealthy',
    database: databaseStatus,
    redis: redisStatus,
  };

  if (overallReady) {
    sendSuccess(res, 'Application connections ready.', statusPayload, {}, 200);
  } else {
    sendError(
      res,
      'Application is not ready. Connections failing.',
      [statusPayload],
      'READY_PROBE_FAILED',
      503
    );
  }
});

/**
 * GET /version
 * Retrieves application version metadata
 */
router.get('/version', (_req: Request, res: Response) => {
  sendSuccess(res, 'Application version data.', {
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

export default router;
