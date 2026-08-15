import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { User, UserStatus } from '../../users/entities/user.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
   schoolId?:string
  iat?: number;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  username: string;
  schoolId?:string
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findById(payload.sub);
    if (!user || user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('User not found or suspended');
    }

    // Reject deactivated or deleted accounts
    if (user.deactivatedAt || user.deletedAt) {
      throw new UnauthorizedException('Account is not active. Please log in again.');
    }

    // Reject tokens issued before the user's last password change
    if (user.passwordChangedAt && payload.iat && payload.iat * 1000 < user.passwordChangedAt.getTime()) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      username: payload.username,
      schoolId: payload.schoolId,
    };
  }
}
