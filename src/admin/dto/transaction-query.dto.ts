import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsISO8601, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Transaction kinds the admin history feed can be filtered by. */
export const ADMIN_TRANSACTION_TYPES = [
  'purchase',
  'gift_sent',
  'gift_received',
  'refund',
  'level_up_reward',
  'daily_free_gift',
  'convert_earnings',
  'withdrawal',
] as const;

export type AdminTransactionType = (typeof ADMIN_TRANSACTION_TYPES)[number];

export class AdminLeaderboardQueryDto {
  @ApiPropertyOptional({ description: 'Max entries to return', default: 10, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export class AdminTransactionQueryDto {
  @ApiPropertyOptional({ description: 'Only transactions involving this user' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Transaction type filter', enum: ADMIN_TRANSACTION_TYPES })
  @IsOptional()
  @IsIn(ADMIN_TRANSACTION_TYPES)
  type?: AdminTransactionType;

  @ApiPropertyOptional({ description: 'Start date (ISO 8601), inclusive' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601), inclusive' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ description: 'Page size', default: 100, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 100;

  @ApiPropertyOptional({ description: 'Number of rows to skip', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
