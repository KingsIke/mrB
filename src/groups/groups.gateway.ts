import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { GroupMember } from './entities/group-member.entity';
import { User } from '../users/entities/user.entity';
import { verifySocketToken } from '../auth/guards/ws-jwt.guard';

export enum GroupWebSocketEvents {
  MESSAGE_NEW = 'message:new',
  MESSAGE_EDITED = 'message:edited',
  MESSAGE_DELETED = 'message:deleted',
  MESSAGE_READ = 'message:read',
  REACTION_ADDED = 'reaction:added',
  REACTION_REMOVED = 'reaction:removed',
  MEMBER_ADDED = 'member:added',
  MEMBER_REMOVED = 'member:removed',
  GROUP_UPDATED = 'group:updated',
  UNREAD_COUNT_UPDATED = 'unread_count:updated',
  // Presence & Typing Events
  USER_JOINED = 'user:joined',
  USER_LEFT = 'user:left',
  ONLINE_LIST = 'user:online_list',
  USER_TYPING = 'user:typing',
  GIFT_SENT = 'gift:sent',
  GIFT_RECEIVED = 'gift_received',
  MESSAGE_PINNED = 'message:pinned',
  MESSAGE_UNPINNED = 'message:unpinned',
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/groups',
  pingTimeout: 30000,
  pingInterval: 25000,
})
export class GroupsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(GroupsGateway.name);

  // Maps groupId -> Set of online userIds in that group
  private readonly roomOnlineUsers = new Map<string, Set<string>>();

  // Global set of all connected userIds (across all namespaces)
  private readonly connectedUserIds = new Set<string>();

  constructor(
    @InjectRepository(GroupMember)
    private readonly groupMemberRepository: Repository<GroupMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // userId -> onlineStatus preference (true = visible to others)
  private readonly onlineVisibleCache = new Map<string, boolean>();

  private async isOnlineVisible(userId: string): Promise<boolean> {
    const cached = this.onlineVisibleCache.get(userId);
    if (cached !== undefined) return cached;
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: { onlineStatus: true },
      });
      const visible = user?.onlineStatus ?? true;
      this.onlineVisibleCache.set(userId, visible);
      return visible;
    } catch {
      return true;
    }
  }

  private clearOnlineVisibleCache(userId: string) {
    this.onlineVisibleCache.delete(userId);
  }

  async handleConnection(client: Socket) {
    const payload = await verifySocketToken(client, this.jwtService, this.configService);
    if (!payload) {
      this.logger.warn(`Rejected unauthenticated socket: ${client.id}`);
      client.disconnect(true);
      return;
    }
    client.data.userId = payload.sub;
    client.data.joinedGroups = new Set<string>();

    // Track globally connected users
    this.connectedUserIds.add(payload.sub);

    // Join personal room so the user receives unread count updates across all devices
    client.join(`user_${payload.sub}`);

    // Broadcast online status change to all subscribers
    this.server.to(`user_${payload.sub}`).emit('user:status_change', {
      userId: payload.sub,
      isOnline: true,
    });

    this.logger.log(`Client connected: ${client.id} (user ${payload.sub})`);
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    const joinedGroups: Set<string> = client.data?.joinedGroups;

    if (userId && joinedGroups) {
      joinedGroups.forEach((groupId) => {
        this.removeUserFromRoomPresence(groupId, userId, client);
      });
    }

    // Remove from global tracking and broadcast status change
    if (userId) {
      // Check if user has other connected sockets before marking offline
      const allSockets = await this.server.fetchSockets();
      const stillConnected = allSockets.some(
        (s: any) => s.data?.userId === userId && s.id !== client.id,
      );
      if (!stillConnected) {
        this.connectedUserIds.delete(userId);
        this.server.to(`user_${userId}`).emit('user:status_change', {
          userId,
          isOnline: false,
        });
      }
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinGroup')
  async handleJoinGroup(
    @MessageBody() data: { groupId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data?.userId;
    if (!userId) {
      return { event: 'error', data: 'Unauthorized' };
    }

    const membership = await this.groupMemberRepository.findOne({
      where: { groupId: data.groupId, userId },
    });
    if (!membership) {
      return { event: 'error', data: 'Not a member of this group' };
    }

    const roomName = `group_${data.groupId}`;
    client.join(roomName);

    if (client.data.joinedGroups) {
      client.data.joinedGroups.add(data.groupId);
    }

    if (!this.roomOnlineUsers.has(data.groupId)) {
      this.roomOnlineUsers.set(data.groupId, new Set());
    }
    const usersSet = this.roomOnlineUsers.get(data.groupId)!;
    usersSet.add(userId);

    // Respect the user's online-status privacy setting: hide them from the
    // presence list (and from join notifications) when they've turned it off.
    const visible = await this.isOnlineVisible(userId);
    const visibleUsers = visible
      ? Array.from(usersSet)
      : Array.from(usersSet).filter((id) => id !== userId);

    client.emit(GroupWebSocketEvents.ONLINE_LIST, visibleUsers);

    if (visible) {
      client.to(roomName).emit(GroupWebSocketEvents.USER_JOINED, {
        userId,
        groupId: data.groupId,
      });
    }

    return { event: 'joinedGroup', data: data.groupId };
  }

  @SubscribeMessage('leaveGroup')
  handleLeaveGroup(
    @MessageBody() data: { groupId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data?.userId;
    if (userId) {
      this.removeUserFromRoomPresence(data.groupId, userId, client);
    }

    client.leave(`group_${data.groupId}`);
    if (client.data.joinedGroups) {
      client.data.joinedGroups.delete(data.groupId);
    }

    return { event: 'leftGroup', data: data.groupId };
  }

  // --- TYPING INDICATORS ---

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @MessageBody() data: { groupId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data?.userId;
    if (!userId) return;

    client.to(`group_${data.groupId}`).emit(GroupWebSocketEvents.USER_TYPING, {
      groupId: data.groupId,
      userId,
      isTyping: true,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @MessageBody() data: { groupId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data?.userId;
    if (!userId) return;

    client.to(`group_${data.groupId}`).emit(GroupWebSocketEvents.USER_TYPING, {
      groupId: data.groupId,
      userId,
      isTyping: false,
    });
  }

  // --- ONLINE STATUS CHECK ---

  @SubscribeMessage('checkOnline')
  handleCheckOnline(
    @MessageBody() data: { userIds: string[] },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.userIds?.length) return;
    const result: Record<string, boolean> = {};
    for (const uid of data.userIds) {
      result[uid] = this.connectedUserIds.has(uid);
    }
    return { event: 'onlineStatus', data: result };
  }

  // --- HELPER METHODS ---

  broadcastToGroup(groupId: string, event: GroupWebSocketEvents, payload: any) {
    this.server.to(`group_${groupId}`).emit(event, payload);
  }

  sendToUser(userId: string, event: GroupWebSocketEvents, payload: any) {
    this.server.to(`user_${userId}`).emit(event, payload);
  }

  private removeUserFromRoomPresence(groupId: string, userId: string, client: Socket) {
    const roomName = `group_${groupId}`;
    const usersSet = this.roomOnlineUsers.get(groupId);

    if (usersSet) {
      usersSet.delete(userId);
      if (usersSet.size === 0) {
        this.roomOnlineUsers.delete(groupId);
      }
    }

    this.clearOnlineVisibleCache(userId);

    client.to(roomName).emit(GroupWebSocketEvents.USER_LEFT, {
      userId,
      groupId,
    });
  }
}