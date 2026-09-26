import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { assertTokenType, TokenType } from '../token-types';

export interface SetupTokenUser {
  userId: string;
  email: string;
  username: string;
}

/**
 * Authorises the authenticator-app enrolment endpoints with the short-lived
 * setup token that `/auth/login` hands to an admin whose password just
 * verified but who has not enrolled an authenticator app yet.
 *
 * It deliberately does NOT use JwtAuthGuard: that strategy only accepts
 * access tokens, and no session exists during enrolment.
 */
@Injectable()
export class TwoFactorSetupGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header: string = request.headers['authorization'] ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

    if (!token) {
      throw new UnauthorizedException('Missing two-factor setup token');
    }

    let payload: { sub: string; email: string; username: string };
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired setup token');
    }

    assertTokenType(payload, TokenType.TWO_FACTOR_SETUP);

    request.user = {
      userId: payload.sub,
      email: payload.email,
      username: payload.username,
    } satisfies SetupTokenUser;

    return true;
  }
}
