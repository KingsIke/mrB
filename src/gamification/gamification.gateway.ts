import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

export enum GamificationWebSocketEvents {
  USER_LEVELED_UP = 'user:leveled_up',
}

/**
 * Broadcasts app-wide gamification moments (currently: level-ups) to every
 * connected client, mirroring PostsGateway's `broadcastToFeed` pattern.
 * Kept as its own gateway/namespace instead of reusing PostsGateway so
 * GamificationModule doesn't need to import PostsModule (which already
 * imports GamificationModule) and create a circular dependency.
 */
@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/gamification',
})
export class GamificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(GamificationGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** Broadcast to every user currently online across the whole app. */
  broadcastLevelUp(payload: {
    userId: string;
    username: string | null;
    profilePictureUrl: string | null;
    level: number;
    title: string;
    emoji: string;
    color: string;
    badge: string;
  }) {
    this.server.emit(GamificationWebSocketEvents.USER_LEVELED_UP, payload);
  }
}
