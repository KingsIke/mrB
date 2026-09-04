import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CoinBattleService } from './coin-battle.service';
import {
  JoinQueueDto,
  ChallengeDto,
  SubmitCoinBattleAnswerDto,
  CoinBattleHistoryDto,
} from './dto/coin-battle.dto';

@ApiTags('Coin Battle')
@Controller('coin-battle')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CoinBattleController {
  constructor(private readonly coinBattleService: CoinBattleService) {}

  // ── Queue ──

  @Post('queue/join')
  @ApiOperation({ summary: 'Join the matchmaking queue with a coin stake' })
  async joinQueue(
    @CurrentUser('userId') userId: string,
    @Body() dto: JoinQueueDto,
  ) {
    return this.coinBattleService.joinQueue(userId, dto.stake);
  }

  @Post('queue/leave')
  @ApiOperation({ summary: 'Leave the matchmaking queue and get refund' })
  async leaveQueue(@CurrentUser('userId') userId: string) {
    return this.coinBattleService.leaveQueue(userId);
  }

  @Get('queue/stats/:stake')
  @ApiOperation({ summary: 'Get queue stats for a specific stake amount' })
  async getQueueStats(@Param('stake') stake: number) {
    return this.coinBattleService.getQueueStats(stake);
  }

  // ── Challenges ──

  @Get('active-users')
  @ApiOperation({ summary: 'List online users available to challenge for a stake' })
  async getActiveUsers(
    @CurrentUser('userId') userId: string,
    @Query('stake') stake: number,
  ) {
    return this.coinBattleService.getActiveUsers(userId, Number(stake));
  }

  @Post('challenge')
  @ApiOperation({ summary: 'Send a coin battle challenge to a specific user' })
  async challenge(
    @CurrentUser('userId') userId: string,
    @Body() dto: ChallengeDto,
  ) {
    return this.coinBattleService.challengeUser(userId, dto);
  }

  @Post('accept/:battleId')
  @ApiOperation({ summary: 'Accept an incoming coin battle challenge' })
  async accept(
    @CurrentUser('userId') userId: string,
    @Param('battleId') battleId: string,
  ) {
    return this.coinBattleService.acceptChallenge(userId, battleId);
  }

  @Post('reject/:battleId')
  @ApiOperation({ summary: 'Reject an incoming coin battle challenge' })
  async reject(
    @CurrentUser('userId') userId: string,
    @Param('battleId') battleId: string,
  ) {
    return this.coinBattleService.rejectChallenge(userId, battleId);
  }

  @Post('cancel/:battleId')
  @ApiOperation({ summary: 'Cancel a pending challenge you sent' })
  async cancel(
    @CurrentUser('userId') userId: string,
    @Param('battleId') battleId: string,
  ) {
    return this.coinBattleService.cancelChallenge(userId, battleId);
  }

  @Get('pending-challenges')
  @ApiOperation({ summary: 'Get incoming WAITING challenges for the logged in user' })
  async getPendingChallenges(@CurrentUser('userId') userId: string) {
    return this.coinBattleService.getPendingChallenges(userId);
  }

  // ── Battle ──

  @Post('submit')
  @ApiOperation({ summary: 'Submit answer during a coin battle' })
  async submitAnswer(
    @CurrentUser('userId') userId: string,
    @Body() dto: SubmitCoinBattleAnswerDto,
  ) {
    return this.coinBattleService.submitAnswer(userId, dto);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get current active coin battle for logged in user' })
  async getActiveBattle(@CurrentUser('userId') userId: string) {
    return this.coinBattleService.getActiveBattle(userId);
  }

  // ── History ──

  @Get('history')
  @ApiOperation({ summary: 'Get paginated coin battle history' })
  async getHistory(
    @CurrentUser('userId') userId: string,
    @Query() query: CoinBattleHistoryDto,
  ) {
    return this.coinBattleService.getBattleHistory(
      userId,
      query.limit ?? 20,
      query.cursor,
    );
  }
}
