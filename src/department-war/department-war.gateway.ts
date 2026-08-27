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
import { extractTokenFromSocket } from '../auth/guards/ws-jwt.guard';

export enum WarWebSocketEvents {
  // Client → Server
  JOIN_BATTLE_ROOM = 'war:join_room',
  LEAVE_BATTLE_ROOM = 'war:leave_room',

  // Server → Client
  CHALLENGE_SENT = 'war:challenge_sent',
  CHALLENGE_ACCEPTED = 'war:challenge_accepted',
  CHALLENGE_REJECTED = 'war:challenge_rejected',
  BATTLE_START = 'war:battle_start',
  QUESTION_START = 'war:question_start',
  ANSWER_SUBMITTED = 'war:answer_submitted',
  SCORE_UPDATE = 'war:score_update',
  BATTLE_ENDED = 'war:battle_ended',
  SCHEDULED_REMINDER = 'war:scheduled_reminder',
  OPPONENT_DISCONNECTED = 'war:opponent_disconnected',
}

@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/department-war',
})
export class DepartmentWarGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(DepartmentWarGateway.name);

  // Track userId → socketId mapping for targeted emits
  private userSockets = new Map<string, string>();
  private socketUsers = new Map<string, string>();

  constructor(private jwtService: JwtService, private configService: ConfigService) {}

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
          this.logger.log(`War client connected: ${client.id} (user: ${userId})`);
          return;
        }
      }
      this.logger.log(`War client connected (unauthenticated): ${client.id}`);
    } catch (err) {
      this.logger.warn(`War connection auth failed: ${client.id}: ${err}`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.socketUsers.get(client.id);
    if (userId) {
      this.userSockets.delete(userId);
      this.socketUsers.delete(client.id);
    }
    this.logger.log(`War client disconnected: ${client.id}`);
  }

  @SubscribeMessage(WarWebSocketEvents.JOIN_BATTLE_ROOM)
  handleJoinBattleRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { battleId: string },
  ) {
    client.join(`war:${data.battleId}`);
    this.logger.log(`Client ${client.id} joined war room: ${data.battleId}`);
  }

  @SubscribeMessage(WarWebSocketEvents.LEAVE_BATTLE_ROOM)
  handleLeaveBattleRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { battleId: string },
  ) {
    client.leave(`war:${data.battleId}`);
    this.logger.log(`Client ${client.id} left war room: ${data.battleId}`);
  }

  // ── Emit helpers ──

  notifyChallengeSent(userId: string, payload: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(WarWebSocketEvents.CHALLENGE_SENT, payload);
    }
  }

  notifyChallengeRejected(userId: string, payload: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(WarWebSocketEvents.CHALLENGE_REJECTED, payload);
    }
  }

  notifyChallengeAccepted(userId: string, payload: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(WarWebSocketEvents.CHALLENGE_ACCEPTED, payload);
    }
  }

  notifyBattleStart(player1Id: string, player2Id: string, payload: any) {
    [player1Id, player2Id].forEach((id) => {
      const socketId = this.userSockets.get(id);
      if (socketId) {
        this.server.to(socketId).emit(WarWebSocketEvents.BATTLE_START, payload);
      }
    });
  }

  notifyQuestionStart(player1Id: string, player2Id: string, payload: any) {
    [player1Id, player2Id].forEach((id) => {
      const socketId = this.userSockets.get(id);
      if (socketId) {
        this.server.to(socketId).emit(WarWebSocketEvents.QUESTION_START, payload);
      }
    });
  }

  notifyAnswerSubmitted(opponentId: string, payload: any) {
    const socketId = this.userSockets.get(opponentId);
    if (socketId) {
      this.server.to(socketId).emit(WarWebSocketEvents.ANSWER_SUBMITTED, payload);
    }
  }

  /**
   * Broadcast live score update to both players after each answer.
   * This gives the client the full scoreboard state in real time.
   */
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
        this.server.to(socketId).emit(WarWebSocketEvents.SCORE_UPDATE, {
          ...payload,
          // Per-recipient flag: whether *this* player is the one who just answered
          youAnswered: id === payload.answeredBy,
        });
      }
    });
  }

  notifyBattleEnded(player1Id: string, player2Id: string, payload: any) {
    [player1Id, player2Id].forEach((id) => {
      const socketId = this.userSockets.get(id);
      if (socketId) {
        this.server.to(socketId).emit(WarWebSocketEvents.BATTLE_ENDED, payload);
      }
    });
  }

  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  getUserSocketId(userId: string): string | undefined {
    return this.userSockets.get(userId);
  }
}
