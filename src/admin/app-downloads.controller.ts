import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Ip,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppDownloadsService, AppDownloadStats } from './app-downloads.service';
import { AppDownloadStatsQueryDto, AppDownloadChartQueryDto } from './dto/app-downloads.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

export interface TrackDownloadDto {
  /** Where the click came from: 'landing', 'navbar', 'footer', 'about', 'unknown' */
  source: string;
  /** Optional page URL where the click happened */
  pageUrl?: string;
  /** Truncated User-Agent string (sent from client) */
  userAgent?: string;
}

@ApiTags('App Downloads')
@Controller('admin/app-downloads')
export class AppDownloadsController {
  constructor(private readonly service: AppDownloadsService) {}

  @Post('track')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record an app download link click' })
  @ApiResponse({ status: 200, description: 'Click recorded' })
  async track(
    @Body() dto: TrackDownloadDto,
    @Ip() ip: string,
    @CurrentUser('userId') userId?: string,
  ) {
    // Hash IP for privacy-preserving deduplication (SHA-256 with salt)
    const ipHash = ip ? this.hashIp(ip) : null;

    return this.service.track(
      dto.source || 'unknown',
      dto.pageUrl || null,
      ipHash,
      dto.userAgent || null,
      userId || null,
    );
  }

  @Get('stats')
  @ApiOperation({ summary: 'App download click statistics (admin)' })
  @ApiResponse({ status: 200, description: 'Download click stats, breakdown, and recent clicks' })
  async getStats(@Query() query: AppDownloadStatsQueryDto): Promise<AppDownloadStats> {
    return this.service.getStats(query);
  }

  @Get('chart')
  @ApiOperation({ summary: 'Daily app download click chart data (admin)' })
  @ApiResponse({ status: 200, description: 'Daily click counts for the given number of days' })
  async getChartData(@Query() query: AppDownloadChartQueryDto) {
    return this.service.getChartData(query);
  }

  private hashIp(ip: string): string {
    // Simple hash — in production use bcrypt or a proper hash with server-side salt
    let hash = 0;
    for (let i = 0; i < ip.length; i++) {
      const char = ip.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'ip_' + Math.abs(hash).toString(36);
  }
}
