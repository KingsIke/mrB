import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

export enum UserWebSocketEvents {
  PROFILE_UPDATED = 'user:profile_updated',
  PROFILE_CHANGED = 'user:profile_changed',
}

export interface ProfileUpdatePayload {
  userId: string;
  profileFrame?: string | null;
  profilePictureUrl?: string | null;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Broadcasts user profile changes (frame, picture, name, etc.) to every
 * connected client so the app updates in real-time without re-fetching.
 *
 * The frontend's `useProfileSocket` hook listens on this `/users` namespace
 * and re-emits a DeviceEventEmitter event that every screen handles.
 */
@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/users',
})
export class UsersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(UsersGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to /users: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from /users: ${client.id}`);
  }

  /**
   * Broadcast a profile-update event to all connected clients.
   * Called by UsersService after a successful profile edit.
   */
  broadcastProfileUpdate(payload: ProfileUpdatePayload) {
    this.logger.log(`Broadcasting profile update for user: ${payload.userId}`);
    this.server.emit(UserWebSocketEvents.PROFILE_UPDATED, payload);
    // Also emit under the alternate event name for broader client compatibility
    this.server.emit(UserWebSocketEvents.PROFILE_CHANGED, payload);
  }
}
