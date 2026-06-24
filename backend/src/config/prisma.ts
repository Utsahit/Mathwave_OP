/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import logger from './logger';

// Instantiate the singleton Prisma Client
export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'info' },
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ],
});

// Bind query events to Pino debug level
prisma.$on('query' as any, (e: any) => {
  logger.debug(
    { query: e.query, params: e.params, duration: `${e.duration}ms` },
    'Prisma Query Executed'
  );
});

// Bind info events to Pino info level
prisma.$on('info' as any, (e: any) => {
  logger.info(e.message);
});

// Bind warn events to Pino warn level
prisma.$on('warn' as any, (e: any) => {
  logger.warn(e.message);
});

// Bind error events to Pino error level
prisma.$on('error' as any, (e: any) => {
  logger.error(e.message);
});

/**
 * Verifies PostgreSQL connection on startup
 */
export async function connectPrisma(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('✅ Connection to PostgreSQL database verified successfully.');
  } catch (error) {
    logger.error({ error }, '❌ Failed to establish connection to PostgreSQL database.');
    throw error;
  }
}

/**
 * Disconnects Prisma Client gracefully during shutdown
 */
export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Database connection closed cleanly.');
  } catch (error) {
    logger.error({ error }, 'Error while closing database connection.');
  }
}

export default prisma;
