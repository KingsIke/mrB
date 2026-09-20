import { SetMetadata } from '@nestjs/common';

export const BLOCK_RESTRICTED_KEY = 'blockRestricted';

// Marks a content-creation route as off-limits to a RESTRICTED account.
// Everything else stays reachable — restricted is a probation tier, not a
// lock: full browsing, comments, messaging, and purchases stay available.
export const BlockRestricted = () => SetMetadata(BLOCK_RESTRICTED_KEY, true);
