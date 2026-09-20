import { SetMetadata } from '@nestjs/common';

export const ALLOW_SUSPENDED_KEY = 'allowSuspended';

// Marks a route as reachable by a suspended (not banned) account. Everything
// else is blocked by JwtAuthGuard once the account is suspended.
export const AllowSuspended = () => SetMetadata(ALLOW_SUSPENDED_KEY, true);
