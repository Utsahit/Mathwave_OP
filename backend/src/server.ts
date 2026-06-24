import http from 'http';
import app from './app';
import { env } from './config/env';
import { connectPrisma, disconnectPrisma } from './config/prisma';
import { connectRedis, disconnectRedis } from './config/redis';
import { realtimeService } from './services/realtime.service';
import logger from './config/logger';
import { schedulerService } from './services/scheduler.service';

let httpServer: http.Server;

/**
 * Boots core connection drivers and starts the HTTP listener
 */
async function bootstrap() {
  try {
    logger.info('Initializing Elixir & Oak backend services...');

    // 1. Establish PostgreSQL database connection via Prisma client
    await connectPrisma();

    // 2. Establish Redis instance connection
    await connectRedis();

    // 3. Listen on configured port
    httpServer = app.listen(env.PORT, () => {
      logger.info(
        `Elixir & Oak Engine running in [${env.NODE_ENV}] mode on port [${env.PORT}]`
      );
      realtimeService.initialize(httpServer);
      logger.info('Socket.IO real-time service initialized.');
      schedulerService.start();
    });

    httpServer.on('error', (error) => {
      logger.error({ error }, 'HTTP server error event received.');
    });
  } catch (error) {
    logger.error({ error }, 'Fatal exception during bootstrap initialization.');
    process.exit(1);
  }
}

/**
 * Clean cleanup of drivers and sockets upon shutdown request signals
 */
async function gracefulShutdown(signal: string) {
  logger.warn(`Received signal [${signal}]. Starting graceful shutdown...`);

  if (httpServer) {
    httpServer.close(async () => {
      logger.info(
        'HTTP server closed cleanly. Terminating resource connection sessions.'
      );

      // Close Redis connection
      await disconnectRedis();

      // Close Prisma Database connection
      await disconnectPrisma();

      logger.info('Graceful shutdown sequence finished. Exiting process.');
      process.exit(0);
    });

    // Force close process if cleanup takes too long
    setTimeout(() => {
      logger.error('Resource termination timeout exceeded. Forcing service termination.');
      process.exit(1);
    }, 10000).unref();
  } else {
    await disconnectRedis();
    await disconnectPrisma();
    process.exit(0);
  }
}

// Bind termination event listeners
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Bind process level panic hooks
process.on('unhandledRejection', (reason, promise) => {
  logger.error(
    { promise, reason },
    'Unhandled promise rejection captured at global execution scope.'
  );
  if (env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception error captured at global execution scope.');
  process.exit(1);
});

process.on('uncaughtExceptionMonitor', (error, origin) => {
  logger.warn({ error, origin }, 'Uncaught exception or rejection monitored.');
});

bootstrap();
export { httpServer };
