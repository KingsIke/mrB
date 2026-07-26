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
import { verifySocketToken } from '../auth/guards/ws-jwt.guard';

export enum GroupWebSocketEvents {
  MESSAGE_NEW = 'message:new',
  MESSAGE_EDITED = 'message:edited',
  MESSAGE_DELETED = 'message:deleted',
  REACTION_ADDED = 'reaction:added',
  REACTION_REMOVED = 'reaction:removed',
  MEMBER_ADDED = 'member:added',
  MEMBER_REMOVED = 'member:removed',
  GROUP_UPDATED = 'group:updated',
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/groups',
})
export class GroupsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(GroupsGateway.name);

  constructor(
    @InjectRepository(GroupMember)
    private readonly groupMemberRepository: Repository<GroupMember>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    const payload = await verifySocketToken(client, this.jwtService, this.configService);
    if (!payload) {
      this.logger.warn(`Rejected unauthenticated socket: ${client.id}`);
      client.disconnect(true);
      return;
    }
    client.data.userId = payload.sub;
    this.logger.log(`Client connected: ${client.id} (user ${payload.sub})`);
  }

  handleDisconnect(client: Socket) {
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

    client.join(`group_${data.groupId}`);
    return { event: 'joinedGroup', data: data.groupId };
  }

  @SubscribeMessage('leaveGroup')
  handleLeaveGroup(
    @MessageBody() data: { groupId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`group_${data.groupId}`);
    return { event: 'leftGroup', data: data.groupId };
  }

  broadcastToGroup(groupId: string, event: GroupWebSocketEvents, payload: any) {
    this.server.to(`group_${groupId}`).emit(event, payload);
  }
}
