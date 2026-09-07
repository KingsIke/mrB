import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsInt, IsOptional, Max, Min } from 'class-validator';

export class AppDownloadStatsQueryDto {
  @ApiPropertyOptional({ description: 'Start date (ISO 8601), inclusive' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601), inclusive' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class AppDownloadChartQueryDto {
  @ApiPropertyOptional({ description: 'Number of days to look back (default 30, max 90)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number = 30;
}
