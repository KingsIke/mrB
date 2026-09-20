import { ForbiddenException, Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_SUSPENDED_KEY } from '../decorators/allow-suspended.decorator';
import { BLOCK_RESTRICTED_KEY } from '../decorators/block-restricted.decorator';
import { AuthenticatedUser } from '../strategies/jwt.strategy';
import { UserStatus } from '../../users/entities/user.entity';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const activated = (await super.canActivate(context)) as boolean;
    if (!activated) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    if (user?.status === UserStatus.SUSPENDED) {
      const allowSuspended = this.reflector.getAllAndOverride<boolean>(ALLOW_SUSPENDED_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowSuspended) {
        throw new ForbiddenException({
          error: 'ACCOUNT_SUSPENDED',
          message: 'Your account is suspended.',
        });
      }
    }

    if (user?.status === UserStatus.RESTRICTED) {
      const blockRestricted = this.reflector.getAllAndOverride<boolean>(BLOCK_RESTRICTED_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (blockRestricted) {
        throw new ForbiddenException({
          error: 'ACCOUNT_RESTRICTED',
          message: 'This action is disabled while your account is restricted.',
        });
      }
    }

    return true;
  }
}
