import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { NotificationService } from './notification.service';
import { redisClient } from '../config/redis';
import logger from '../utils/logger';

export class SocketService {
  private io: SocketServer;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socket IDs

  constructor(server: HttpServer) {
    this.io = new SocketServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
      },
    });

    // Set the socket server instance for NotificationService
    NotificationService.setSocketServer(this.io);

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        socket.data.userId = decoded.userId;
        socket.data.userType = decoded.userType;

        next();
      } catch (err) {
        next(new Error('Authentication error'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', socket => {
      const userId = socket.data.userId;
      logger.info(`User ${userId} connected with socket ${socket.id}`);

      // Add socket to user's room
      socket.join(`user:${userId}`);

      // Track connected sockets for the user
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(socket.id);

      // Update user's online status
      this.updateUserStatus(userId, 'online');

      // Handle joining conversation rooms
      socket.on('join:conversation', async (conversationId: string) => {
        try {
          // Verify user is participant in the conversation
          const isParticipant = await this.verifyConversationParticipant(
            conversationId,
            userId
          );

          if (isParticipant) {
            socket.join(`conversation:${conversationId}`);
            socket.emit('joined:conversation', { conversationId });
          } else {
            socket.emit('error', {
              message: 'Unauthorized to join conversation',
            });
          }
        } catch (error) {
          socket.emit('error', { message: 'Failed to join conversation' });
        }
      });

      // Handle leaving conversation rooms
      socket.on('leave:conversation', (conversationId: string) => {
        socket.leave(`conversation:${conversationId}`);
        socket.emit('left:conversation', { conversationId });
      });

      // Handle typing indicators
      socket.on('typing:start', (data: { conversationId: string }) => {
        socket.to(`conversation:${data.conversationId}`).emit('user:typing', {
          userId,
          conversationId: data.conversationId,
        });
      });

      socket.on('typing:stop', (data: { conversationId: string }) => {
        socket
          .to(`conversation:${data.conversationId}`)
          .emit('user:stopped-typing', {
            userId,
            conversationId: data.conversationId,
          });
      });

      // Handle message read receipts
      socket.on(
        'message:read',
        (data: { conversationId: string; messageId: string }) => {
          socket
            .to(`conversation:${data.conversationId}`)
            .emit('message:read-receipt', {
              userId,
              messageId: data.messageId,
              readAt: new Date(),
            });
        }
      );

      // Handle presence updates
      socket.on('presence:update', (status: 'online' | 'away' | 'busy') => {
        this.updateUserStatus(userId, status);
        this.broadcastUserPresence(userId, status);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        logger.info(`User ${userId} disconnected with socket ${socket.id}`);

        // Remove socket from tracking
        const userSockets = this.connectedUsers.get(userId);
        if (userSockets) {
          userSockets.delete(socket.id);

          // If user has no more connected sockets, update status to offline
          if (userSockets.size === 0) {
            this.connectedUsers.delete(userId);
            this.updateUserStatus(userId, 'offline');
            this.broadcastUserPresence(userId, 'offline');
          }
        }
      });
    });
  }

  private async verifyConversationParticipant(
    conversationId: string,
    userId: string
  ): Promise<boolean> {
    // TODO: Implement database check to verify user is participant
    // For now, return true (implement actual verification)
    return true;
  }

  private async updateUserStatus(userId: string, status: string) {
    const key = `user:status:${userId}`;
    await redisClient.setex(key, 3600, status); // Cache for 1 hour
  }

  private broadcastUserPresence(userId: string, status: string) {
    // Broadcast to all users who might be interested (e.g., contacts, conversation participants)
    this.io.emit('user:presence', { userId, status });
  }

  // Public methods for sending events from other services
  public sendToUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  public sendToConversation(conversationId: string, event: string, data: any) {
    this.io.to(`conversation:${conversationId}`).emit(event, data);
  }

  public broadcastToAll(event: string, data: any) {
    this.io.emit(event, data);
  }

  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  public getUserSocketCount(userId: string): number {
    return this.connectedUsers.get(userId)?.size || 0;
  }
}
