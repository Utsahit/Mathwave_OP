import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { env } from './env';

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const getPrettyStream = () => require('pino-pretty')({ colorize: true });

// In standard pino multi-stream, each stream receives log events at or above its designated level.
const streams: pino.StreamEntry[] = [
  {
    level: 'info',
    stream: env.NODE_ENV === 'development' ? getPrettyStream() : process.stdout,
  },
  {
    level: 'info',
    stream: pino.destination({
      dest: path.join(logsDir, 'app.log'),
      sync: false,
    }),
  },
  {
    level: 'error',
    stream: pino.destination({
      dest: path.join(logsDir, 'error.log'),
      sync: true,
    }),
  },
];

export const logger = pino(
  {
    level: env.NODE_ENV === 'test' ? 'silent' : 'info',
    redact: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'token',
      'passwordHash',
      'refreshToken',
    ],
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.multistream(streams)
);

export const securityLogger = pino(
  {
    level: env.NODE_ENV === 'test' ? 'silent' : 'info',
    redact: ['password', 'token', 'passwordHash', 'refreshToken'],
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.multistream([
    {
      level: 'info',
      stream: pino.destination({
        dest: path.join(logsDir, 'security.log'),
        sync: true,
      }),
    },
    {
      level: 'info',
      stream: env.NODE_ENV === 'development' ? getPrettyStream() : process.stdout,
    },
  ])
);

export default logger;
