import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, IsNull } from 'typeorm';
import { extractTokenFromSocket, isSocketAccessBlocked } from '../auth/guards/ws-jwt.guard';
import { TokenType, assertTokenType } from '../auth/token-types';
import { WhotTablePlayer } from './entities/whot-table-player.entity';
import { WhotTable, WhotTableStatus } from './entities/whot-table.entity';
import { User } from '../users/entities/user.entity';

export enum WhotWebSocketEvents {
  // Client → Server — unprefixed to match the mobile client's useWhotSocket.ts
  JOIN_TABLE_ROOM = 'join_table',
  LEAVE_TABLE_ROOM = 'leave_table',

  // Server → Client
  QUEUE_JOINED = 'whot:queue_joined',
  QUEUE_LEFT = 'whot:queue_left',
  TABLE_UPDATE = 'whot:table_update',
  TABLE_START = 'whot:table_start',
  CARD_PLAYED = 'whot:card_played',
  CARD_DRAWN = 'whot:card_drawn',
  TURN_CHANGED = 'whot:turn_changed',
  TABLE_ENDED = 'whot:table_ended',
  PLAYER_DISCONNECTED = 'whot:player_disconnected',
}

const ACTIVE_TABLE_STATUSES = [
  WhotTableStatus.QUEUED,
  WhotTableStatus.MATCHED,
  WhotTableStatus.COUNTDOWN,
  WhotTableStatus.ACTIVE,
];

@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/whot',
})
export class WhotGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WhotGateway.name);

  // Track userId → socketId mapping
  private userSockets = new Map<string, string>();
  private socketUsers = new Map<string, string>();

  // Set by the service to avoid a circular DI dependency
  private onDisconnectCallback: ((userId: string) => Promise<void>) | null = null;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(WhotTable) private tableRepo: Repository<WhotTable>,
    @InjectRepository(WhotTablePlayer) private playerRepo: Repository<WhotTablePlayer>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  setOnDisconnectCallback(cb: (userId: string) => Promise<void>) {
    this.onDisconnectCallback = cb;
  }

  async handleConnection(client: Socket) {
    try {
      const token = extractTokenFromSocket(client);
      if (token) {
        const payload = await this.jwtService.verifyAsync(token, {
          secret: this.configService.get('JWT_SECRET'),
        });
        assertTokenType(payload, TokenType.ACCESS);
        const userId = payload.sub || payload.id;
        if (userId) {
          const user = await this.userRepo.findOne({
            where: { id: userId },
            select: { id: true, status: true },
          });
          if (!user || isSocketAccessBlocked(user.status)) {
            this.logger.warn(`Rejected whot socket for ${user?.status ?? 'missing'} user: ${userId}`);
            client.emit('auth:blocked', { reason: user?.status ?? 'not_found' });
            client.disconnect(true);
            return;
          }
          this.userSockets.set(userId, client.id);
          this.socketUsers.set(client.id, userId);
          this.logger.log(`Whot client connected: ${client.id} (user: ${userId})`);

          // Clear any pending disconnect mark so the stale-turn sweep stops
          // auto-drawing on their behalf now that they're back.
          const seat = await this.playerRepo.findOne({
            where: { userId, table: { status: In(ACTIVE_TABLE_STATUSES) }, disconnectedAt: Not(IsNull()) },
          });
          if (seat) {
            await this.playerRepo.update({ id: seat.id }, { disconnectedAt: null });
            this.logger.log(`Whot client ${userId} reconnected mid-game at table ${seat.tableId}`);
          }
          return;
        }
      }
      this.logger.log(`Whot client connected (unauthenticated): ${client.id}`);
    } catch (err) {
      this.logger.warn(`Whot connection auth failed: ${client.id}: ${err}`);
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = this.socketUsers.get(client.id);
    if (userId) {
      this.userSockets.delete(userId);
      this.socketUsers.delete(client.id);

      try {
        const seat = await this.playerRepo.findOne({
          where: { userId, table: { status: In(ACTIVE_TABLE_STATUSES) } },
          relations: ['table'],
        });

        if (seat && this.onDisconnectCallback) {
          this.logger.log(`Whot client ${userId} disconnected with active table ${seat.tableId} (status: ${seat.table.status})`);
          this.server.to(this.roomName(seat.tableId)).emit(WhotWebSocketEvents.PLAYER_DISCONNECTED, {
            tableId: seat.tableId,
            userId,
          });
          await this.onDisconnectCallback(userId);
        }
      } catch (err) {
        this.logger.error(`handleDisconnect: failed to check active table for ${userId}: ${err}`);
      }
    }
    this.logger.log(`Whot client disconnected: ${client.id}`);
  }

  private roomName(tableId: string): string {
    return `whot:${tableId}`;
  }

  @SubscribeMessage(WhotWebSocketEvents.JOIN_TABLE_ROOM)
  handleJoinTableRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { tableId: string }) {
    client.join(this.roomName(data.tableId));
    this.logger.log(`Client ${client.id} joined whot room: ${data.tableId}`);
  }

  @SubscribeMessage(WhotWebSocketEvents.LEAVE_TABLE_ROOM)
  handleLeaveTableRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { tableId: string }) {
    client.leave(this.roomName(data.tableId));
    this.logger.log(`Client ${client.id} left whot room: ${data.tableId}`);
  }

  // ── Emit helpers ──

  /** Per-socket emit — only the joining user should see this. */
  notifyQueueJoined(userId: string, payload: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(WhotWebSocketEvents.QUEUE_JOINED, payload);
    }
  }

  notifyQueueLeft(userId: string, payload: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(WhotWebSocketEvents.QUEUE_LEFT, payload);
    }
  }

  /** Public: seats filled / players joined — broadcast to the whole table room. */
  notifyTableUpdate(tableId: string, payload: any) {
    this.server.to(this.roomName(tableId)).emit(WhotWebSocketEvents.TABLE_UPDATE, payload);
  }

  /**
   * Table started: dealing happened. Each seated player gets their OWN hand via
   * a per-socket emit — this is the critical hidden-information boundary.
   * `publicPayload` (hand counts only) is broadcast to the room for completeness,
   * then each player additionally receives their private hand.
   */
  notifyTableStart(players: { userId: string; hand: string[] }[], publicPayload: any) {
    this.server.to(this.roomName(publicPayload.tableId)).emit(WhotWebSocketEvents.TABLE_START, publicPayload);
    for (const p of players) {
      const socketId = this.userSockets.get(p.userId);
      if (socketId) {
        this.server.to(socketId).emit(WhotWebSocketEvents.TABLE_START, { ...publicPayload, yourHand: p.hand });
      }
    }
  }

  /** Public: a card was played — broadcast to the room. */
  notifyCardPlayed(tableId: string, payload: any) {
    this.server.to(this.roomName(tableId)).emit(WhotWebSocketEvents.CARD_PLAYED, payload);
  }

  /** Public broadcast (hand counts only) that cards were drawn. */
  notifyCardDrawnPublic(tableId: string, payload: any) {
    this.server.to(this.roomName(tableId)).emit(WhotWebSocketEvents.CARD_DRAWN, payload);
  }

  /** Private: send a specific player's updated hand after they draw. */
  notifyHandUpdate(userId: string, payload: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(WhotWebSocketEvents.CARD_DRAWN, payload);
    }
  }

  notifyTurnChanged(tableId: string, payload: any) {
    this.server.to(this.roomName(tableId)).emit(WhotWebSocketEvents.TURN_CHANGED, payload);
  }

  notifyTableEnded(tableId: string, payload: any) {
    this.server.to(this.roomName(tableId)).emit(WhotWebSocketEvents.TABLE_ENDED, payload);
  }

  notifyPlayerDisconnected(tableId: string, payload: any) {
    this.server.to(this.roomName(tableId)).emit(WhotWebSocketEvents.PLAYER_DISCONNECTED, payload);
  }

  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  getUserSocketId(userId: string): string | undefined {
    return this.userSockets.get(userId);
  }
}
