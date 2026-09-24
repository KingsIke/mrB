import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WhotService } from './whot.service';
import { JoinTableDto, PlayCardDto, DrawCardDto, WhotHistoryDto, BotStartDto } from './dto/whot.dto';

@ApiTags('Whot')
@Controller('whot')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WhotController {
  constructor(private readonly whotService: WhotService) {}

  // ── Queue ──

  @Post('queue/join')
  @ApiOperation({ summary: 'Join (or create) a public Whot table for a stake + table size' })
  async joinQueue(@CurrentUser('userId') userId: string, @Body() dto: JoinTableDto) {
    return this.whotService.createOrJoinTable(userId, dto.stake, dto.maxPlayers);
  }

  @Post('queue/leave')
  @ApiOperation({ summary: 'Leave the Whot queue and get refunded' })
  async leaveQueue(@CurrentUser('userId') userId: string) {
    return this.whotService.leaveQueue(userId);
  }

  @Get('queue/stats/:stake')
  @ApiOperation({ summary: 'Get queue stats for a (stake, maxPlayers) pair' })
  async getQueueStats(@Param('stake') stake: number, @Query('maxPlayers') maxPlayers: number) {
    return this.whotService.getQueueStats(Number(stake), Number(maxPlayers));
  }

  @Post('bot/start')
  @ApiOperation({ summary: 'Start a 1v1 table against the computer opponent (no queue, no other players)' })
  async startBotTable(@CurrentUser('userId') userId: string, @Body() dto: BotStartDto) {
    return this.whotService.startBotTable(userId, dto.stake);
  }

  // ── Gameplay ──

  @Post('play')
  @ApiOperation({ summary: 'Play a card from your hand' })
  async play(@CurrentUser('userId') userId: string, @Body() dto: PlayCardDto) {
    return this.whotService.playCard(userId, dto.tableId, dto.card, dto.calledShape);
  }

  @Post('draw')
  @ApiOperation({ summary: 'Draw a card (no legal play, or resolving a pending Pick stack)' })
  async draw(@CurrentUser('userId') userId: string, @Body() dto: DrawCardDto) {
    return this.whotService.drawCard(userId, dto.tableId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get current active/queued Whot table for the logged in user' })
  async getActive(@CurrentUser('userId') userId: string) {
    return this.whotService.getActiveTable(userId);
  }

  // ── History ──

  @Get('history')
  @ApiOperation({ summary: 'Get paginated Whot table history' })
  async getHistory(@CurrentUser('userId') userId: string, @Query() query: WhotHistoryDto) {
    return this.whotService.getHistory(userId, query.limit ?? 20, query.cursor);
  }
}
