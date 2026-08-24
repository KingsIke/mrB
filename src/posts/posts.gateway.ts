import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Injectable, Logger } from "@nestjs/common";

export enum PostWebSocketEvents {
  POST_CREATED = "post:created",
  POST_LIKED = "post:liked",
  POST_UNLIKED = "post:unliked",
  COMMENT_ADDED = "comment:added",
  COMMENT_LIKED = "comment:liked",
  COMMENT_UNLIKED = "comment:unliked",
  COMMENT_DELETED = "comment:deleted",
  POST_RESHARED = "post:reshared",
  POST_DELETED = "post:deleted",
  GIFT_SENT = "gift:sent",
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: "*",
  },
  namespace: "/posts",
  pingTimeout: 30000,
  pingInterval: 25000,
})
export class PostsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(PostsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("joinPost")
  handleJoinPost(
    @MessageBody() data: { postId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`post_${data.postId}`);
    return { event: "joinedPost", data: data.postId };
  }

  @SubscribeMessage("leavePost")
  handleLeavePost(
    @MessageBody() data: { postId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`post_${data.postId}`);
    return { event: "leftPost", data: data.postId };
  }

  /** Broadcast to all users on the feed */
  broadcastToFeed(event: PostWebSocketEvents, payload: any) {
    this.server.emit(event, payload);
  }

  /** Broadcast to specific room (e.g. users viewing comment section of a post) */
  broadcastToPostRoom(postId: string, event: PostWebSocketEvents, payload: any) {
    this.server.to(`post_${postId}`).emit(event, payload);
  }
}