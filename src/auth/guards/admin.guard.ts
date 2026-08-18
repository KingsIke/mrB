import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedUser } from '../strategies/jwt.strategy';

/**
 * Restricts an endpoint to admins listed in the ADMIN_EMAILS env var
 * (comma-separated). Must be used together with JwtAuthGuard so that
 * request.user is populated.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    const allowed = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    if (!user || !allowed.includes((user.email ?? '').toLowerCase())) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
