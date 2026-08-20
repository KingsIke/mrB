import { SetMetadata } from '@nestjs/common';

export const PERK_KEY = 'required_perk';

/**
 * Mark an endpoint as requiring a specific level perk.
 *
 * Usage:
 *   @RequirePerk('Create Groups')
 *   @UseGuards(JwtAuthGuard, PerkGuard)
 *   async createGroup(...) { }
 */
export const RequirePerk = (perk: string) => SetMetadata(PERK_KEY, perk);
