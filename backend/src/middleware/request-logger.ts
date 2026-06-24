import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

/**
 * Express middleware logging request details after response completes
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;

    logger.info(
      {
        method: req.method,
        url: req.originalUrl || req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: Array.isArray(clientIp) ? clientIp[0] : clientIp,
      },
      'HTTP Request Handled'
    );
  });

  next();
}

export default requestLogger;
