import http from 'http';
import { Server, Namespace, Socket } from 'socket.io';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { prisma } from '../config/prisma';
import logger from '../config/logger';

const AUTH_MIDDLEWARE = async (
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token || typeof token !== 'string') {
      return next(new Error('Authentication token is missing.'));
    }

    const payload: JwtPayload = verifyAccessToken(token);

    const activeSession = await prisma.userSession.findUnique({
      where: { id: payload.jti },
    });

    if (!activeSession) {
      return next(new Error('Authentication session expired or invalid.'));
    }

    socket.data.user = {
      userId: payload.userId,
      email: payload.email,
      roleName: payload.roleName,
    };

    next();
  } catch {
    next(new Error('Authentication session expired or invalid.'));
  }
};

export class RealtimeService {
  private io: Server | null = null;
  private kitchenNamespace: Namespace | null = null;
  private orderNamespace: Namespace | null = null;
  private maxClients = 200;

  setMaxClients(max: number): void {
    this.maxClients = max;
  }

  initialize(httpServer: http.Server): void {
    this.io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.io.use(AUTH_MIDDLEWARE);

    this.kitchenNamespace = this.io.of('/kitchen');
    this.orderNamespace = this.io.of('/orders');

    this.kitchenNamespace.use(AUTH_MIDDLEWARE);
    this.orderNamespace.use(AUTH_MIDDLEWARE);

    this.kitchenNamespace.on('connection', (socket) => {
      const totalClients = this.io?.engine.clientsCount ?? 0;
      if (totalClients > this.maxClients) {
        logger.warn(
          { totalClients, maxClients: this.maxClients },
          'Max clients reached — disconnecting'
        );
        socket.disconnect(true);
        return;
      }
      const roleName = socket.data.user?.roleName;
      if (roleName === 'CUSTOMER') {
        socket.disconnect(true);
        return;
      }
      socket.join('kitchen-staff');
    });

    this.orderNamespace.on('connection', (socket) => {
      const totalClients = this.io?.engine.clientsCount ?? 0;
      if (totalClients > this.maxClients) {
        logger.warn(
          { totalClients, maxClients: this.maxClients },
          'Max clients reached — disconnecting'
        );
        socket.disconnect(true);
        return;
      }
      const userId = socket.data.user?.userId;
      if (userId) {
        socket.join(`user:${userId}`);
      }
    });
  }

  broadcastToKitchen(event: string, data: unknown): void {
    if (!this.kitchenNamespace) return;
    try {
      this.kitchenNamespace.to('kitchen-staff').emit(event, data);
    } catch (err) {
      logger.warn({ err }, 'Socket.IO broadcastToKitchen failed');
    }
  }

  broadcastToOrder(orderId: string, event: string, data: unknown): void {
    if (!this.orderNamespace) return;
    try {
      this.orderNamespace.to(`order:${orderId}`).emit(event, data);
    } catch (err) {
      logger.warn({ err }, 'Socket.IO broadcastToOrder failed');
    }
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    if (!this.orderNamespace) return;
    try {
      this.orderNamespace.to(`user:${userId}`).emit(event, data);
    } catch (err) {
      logger.warn({ err }, 'Socket.IO emitToUser failed');
    }
  }

  joinOrderRoom(userId: string, orderId: string): void {
    if (!this.orderNamespace) return;
    try {
      this.orderNamespace.to(`user:${userId}`).emit('JOIN_ORDER_ROOM', { orderId });
    } catch (err) {
      logger.warn({ err }, 'Socket.IO joinOrderRoom failed');
    }
  }
}

export const realtimeService = new RealtimeService();
