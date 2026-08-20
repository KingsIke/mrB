import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class PastQuestionAnalyticsQueryDto {
  @ApiPropertyOptional({ description: 'Start date (ISO 8601), inclusive' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601), inclusive' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
