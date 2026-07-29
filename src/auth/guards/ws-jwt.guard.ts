import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { JwtPayload } from '../strategies/jwt.strategy';

export function extractTokenFromSocket(client: Socket): string | null {
  // 1. Check auth object or headers
  let rawToken: string | undefined =
    (client.handshake.auth?.token as string | undefined) ||
    client.handshake.headers.authorization;

  if (!rawToken) return null;

  // 2. Safely strip 'Bearer ' if present
  if (rawToken.startsWith('Bearer ')) {
    return rawToken.slice('Bearer '.length).trim();
  }

  return rawToken.trim();
}

/**
 * Verifies the socket's JWT and returns the payload, or null if missing/invalid.
 * Used directly in gateways' handleConnection since Nest guards don't run on that lifecycle hook.
 */
export async function verifySocketToken(
  client: Socket,
  jwtService: JwtService,
  configService: ConfigService,
): Promise<JwtPayload | null> {
  const token = extractTokenFromSocket(client);
  if (!token) return null;

  try {
    return await jwtService.verifyAsync<JwtPayload>(token, {
      secret: configService.get('JWT_SECRET'),
    });
  } catch {
    return null;
  }
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    if (client.data?.userId) return true;

    const payload = await verifySocketToken(client, this.jwtService, this.configService);
    if (!payload) {
      throw new WsException('Unauthorized');
    }
    client.data.userId = payload.sub;
    return true;
  }
}
