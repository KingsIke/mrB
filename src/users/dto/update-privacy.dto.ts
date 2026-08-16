import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePrivacyDto {
  @ApiPropertyOptional({ description: 'Hide profile from non-followers', example: false })
  @IsOptional()
  @IsBoolean()
  privateProfile?: boolean;

  @ApiPropertyOptional({ description: 'Show when you are online to other users', example: true })
  @IsOptional()
  @IsBoolean()
  onlineStatus?: boolean;

  @ApiPropertyOptional({ description: 'Let others see when you have read their messages', example: true })
  @IsOptional()
  @IsBoolean()
  readReceipts?: boolean;

  @ApiPropertyOptional({ description: 'Share activity / leaderboard participation', example: true })
  @IsOptional()
  @IsBoolean()
  activityStatus?: boolean;

  @ApiPropertyOptional({ description: 'Allow personalized content using your data', example: true })
  @IsOptional()
  @IsBoolean()
  dataSharing?: boolean;
}
