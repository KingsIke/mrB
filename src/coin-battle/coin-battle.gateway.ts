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
import { Repository, In } from 'typeorm';
import { extractTokenFromSocket } from '../auth/guards/ws-jwt.guard';
import { CoinBattle, CoinBattleStatus } from './entities/coin-battle.entity';

export enum CoinBattleWebSocketEvents {
  // Client → Server
  JOIN_BATTLE_ROOM = 'coin-battle:join_room',
  LEAVE_BATTLE_ROOM = 'coin-battle:leave_room',
  JOIN_QUEUE = 'coin-battle:join_queue',
  LEAVE_QUEUE = 'coin-battle:leave_queue',

  // Server → Client
  QUEUE_JOINED = 'coin-battle:queue_joined',
  QUEUE_LEFT = 'coin-battle:queue_left',
  MATCH_FOUND = 'coin-battle:match_found',
  CHALLENGE_SENT = 'coin-battle:challenge_sent',
  CHALLENGE_ACCEPTED = 'coin-battle:challenge_accepted',
  CHALLENGE_REJECTED = 'coin-battle:challenge_rejected',
  BATTLE_START = 'coin-battle:battle_start',
  QUESTION_START = 'coin-battle:question_start',
  SCORE_UPDATE = 'coin-battle:score_update',
  BATTLE_ENDED = 'coin-battle:battle_ended',
  OPPONENT_DISCONNECTED = 'coin-battle:opponent_disconnected',
}

@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/coin-battle',
})
export class CoinBattleGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CoinBattleGateway.name);

  // Track userId → socketId mapping
  private userSockets = new Map<string, string>();
  private socketUsers = new Map<string, string>();

  // Set by module to avoid circular dependency
  private onDisconnectCallback: ((userId: string) => Promise<void>) | null = null;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(CoinBattle) private battleRepo: Repository<CoinBattle>,
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
        const userId = payload.sub || payload.id;
        if (userId) {
          this.userSockets.set(userId, client.id);
          this.socketUsers.set(client.id, userId);
          this.logger.log(`Coin battle client connected: ${client.id} (user: ${userId})`);
          return;
        }
      }
      this.logger.log(`Coin battle client connected (unauthenticated): ${client.id}`);
    } catch (err) {
      this.logger.warn(`Coin battle connection auth failed: ${client.id}: ${err}`);
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = this.socketUsers.get(client.id);
    if (userId) {
      this.userSockets.delete(userId);
      this.socketUsers.delete(client.id);

      // Check if this user was in an active coin battle — refund if so
      try {
        const activeBattle = await this.battleRepo.findOne({
          where: [
            { player1Id: userId, status: In([CoinBattleStatus.QUEUED, CoinBattleStatus.MATCHED, CoinBattleStatus.COUNTDOWN]) },
            { player2Id: userId, status: In([CoinBattleStatus.QUEUED, CoinBattleStatus.MATCHED, CoinBattleStatus.COUNTDOWN]) },
          ],
        });

        if (activeBattle && this.onDisconnectCallback) {
          this.logger.log(`Coin battle client ${userId} disconnected with active battle ${activeBattle.id} (status: ${activeBattle.status})`);
          await this.onDisconnectCallback(userId);
        }
      } catch (err) {
        this.logger.error(`handleDisconnect: failed to check active battle for ${userId}: ${err}`);
      }
    }
    this.logger.log(`Coin battle client disconnected: ${client.id}`);
  }

  @SubscribeMessage(CoinBattleWebSocketEvents.JOIN_BATTLE_ROOM)
  handleJoinBattleRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { battleId: string },
  ) {
    client.join(`coin-battle:${data.battleId}`);
    this.logger.log(`Client ${client.id} joined coin battle room: ${data.battleId}`);
  }

  @SubscribeMessage(CoinBattleWebSocketEvents.LEAVE_BATTLE_ROOM)
  handleLeaveBattleRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { battleId: string },
  ) {
    client.leave(`coin-battle:${data.battleId}`);
    this.logger.log(`Client ${client.id} left coin battle room: ${data.battleId}`);
  }

  // ── Emit helpers ──

  notifyQueueJoined(userId: string, payload: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(CoinBattleWebSocketEvents.QUEUE_JOINED, payload);
    }
  }

  notifyQueueLeft(userId: string, payload: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(CoinBattleWebSocketEvents.QUEUE_LEFT, payload);
    }
  }

  notifyMatchFound(player1Id: string, player2Id: string, payload: any) {
    [player1Id, player2Id].forEach((id) => {
      const socketId = this.userSockets.get(id);
      if (socketId) {
        this.server.to(socketId).emit(CoinBattleWebSocketEvents.MATCH_FOUND, payload);
      }
    });
  }

  /** A challenge was sent to `userId` (they are player2 / the acceptor). */
  notifyChallengeSent(userId: string, payload: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(CoinBattleWebSocketEvents.CHALLENGE_SENT, payload);
    }
  }

  /** The challenger's request was accepted (challenger is player1). */
  notifyChallengeAccepted(userId: string, payload: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(CoinBattleWebSocketEvents.CHALLENGE_ACCEPTED, payload);
    }
  }

  notifyChallengeRejected(userId: string, payload: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(CoinBattleWebSocketEvents.CHALLENGE_REJECTED, payload);
    }
  }

  notifyBattleStart(player1Id: string, player2Id: string, payload: any) {
    [player1Id, player2Id].forEach((id) => {
      const socketId = this.userSockets.get(id);
      if (socketId) {
        this.server.to(socketId).emit(CoinBattleWebSocketEvents.BATTLE_START, payload);
      }
    });
  }

  notifyQuestionStart(player1Id: string, player2Id: string, payload: any) {
    [player1Id, player2Id].forEach((id) => {
      const socketId = this.userSockets.get(id);
      if (socketId) {
        this.server.to(socketId).emit(CoinBattleWebSocketEvents.QUESTION_START, payload);
      }
    });
  }

  notifyScoreUpdate(
    player1Id: string,
    player2Id: string,
    payload: {
      battleId: string;
      questionIndex: number;
      totalQuestions: number;
      player1Score: number;
      player2Score: number;
      player1Answered: boolean;
      player2Answered: boolean;
      answeredBy: string;
      pointsEarned: number;
      isCorrect: boolean;
    },
  ) {
    [player1Id, player2Id].forEach((id) => {
      const socketId = this.userSockets.get(id);
      if (socketId) {
        this.server.to(socketId).emit(CoinBattleWebSocketEvents.SCORE_UPDATE, {
          ...payload,
          youAnswered: id === payload.answeredBy,
        });
      }
    });
  }

  notifyBattleEnded(player1Id: string, player2Id: string, payload: any) {
    [player1Id, player2Id].forEach((id) => {
      const socketId = this.userSockets.get(id);
      if (socketId) {
        this.server.to(socketId).emit(CoinBattleWebSocketEvents.BATTLE_ENDED, payload);
      }
    });
  }

  notifyOpponentDisconnected(userId: string, payload: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(CoinBattleWebSocketEvents.OPPONENT_DISCONNECTED, payload);
    }
  }

  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  getUserSocketId(userId: string): string | undefined {
    return this.userSockets.get(userId);
  }
}
