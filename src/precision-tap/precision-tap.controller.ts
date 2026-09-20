import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrecisionTapService } from './precision-tap.service';
import { StartRoundDto } from './dto/start-round.dto';
import { TapDto } from './dto/tap.dto';

@ApiTags('Precision Tap')
@Controller('precision-tap')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PrecisionTapController {
  constructor(private readonly precisionTapService: PrecisionTapService) {}

  @Get('state')
  @ApiOperation({ summary: 'Get stake limits and daily allowance remaining' })
  async getState(@CurrentUser('userId') userId: string) {
    return this.precisionTapService.getState(userId);
  }

  @Post('round')
  @ApiOperation({ summary: 'Stake coins and start a new round' })
  async startRound(@CurrentUser('userId') userId: string, @Body() dto: StartRoundDto) {
    return this.precisionTapService.startRound(userId, dto.stake, dto.streakCount);
  }

  @Post('tap')
  @ApiOperation({ summary: 'Tap to resolve the active round' })
  async tap(@CurrentUser('userId') userId: string, @Body() dto: TapDto) {
    return this.precisionTapService.tap(userId, dto.roundId);
  }
}
