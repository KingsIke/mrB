import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GamificationService } from '../gamification.service';
import { PERK_KEY } from '../decorators/require-perk.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

/**
 * Guard that checks whether the authenticated user's current level
 * includes the perk required by the @RequirePerk() decorator.
 *
 * Must be used together with JwtAuthGuard so that request.user is populated.
 *
 * Example:
 *   @RequirePerk('Create Groups')
 *   @UseGuards(JwtAuthGuard, PerkGuard)
 *   async createGroup(...) { }
 */
@Injectable()
export class PerkGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly gamificationService: GamificationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPerk = this.reflector.get<string>(PERK_KEY, context.getHandler());
    if (!requiredPerk) return true; // no perk required → allow

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user?.userId) {
      throw new ForbiddenException('Authentication required');
    }

    const hasPerk = await this.gamificationService.hasPerk(user.userId, requiredPerk);
    if (!hasPerk) {
      throw new ForbiddenException(
        `This feature requires the "${requiredPerk}" perk. Level up to unlock it!`,
      );
    }

    return true;
  }
}
