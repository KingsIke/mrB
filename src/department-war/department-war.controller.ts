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
import { DepartmentWarService } from './department-war.service';
import {
  ChallengeDto,
  SubmitAnswerDto,
  MatchmakingDto,
  ScheduleBattleDto,
} from './dto/war.dto';

@ApiTags('Department War')
@Controller('war')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DepartmentWarController {
  constructor(private readonly warService: DepartmentWarService) {}

  // ── Matchmaking ──

  @Get('quick-match/active-users')
  @ApiOperation({ summary: 'List online users available for a quick match, to pick from before sending a request' })
  async getQuickMatchCandidates(
    @CurrentUser('userId') userId: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.warService.getQuickMatchCandidates(userId, departmentId);
  }

  @Post('matchmaking')
  @ApiOperation({ summary: 'Send a quick-match request to a chosen opponent (or auto-match if none given)' })
  async findMatch(
    @CurrentUser('userId') userId: string,
    @Body() dto: MatchmakingDto,
  ) {
    return this.warService.findMatch(userId, dto);
  }

  // ── Challenge ──

  @Post('challenge')
  @ApiOperation({ summary: 'Send direct 1v1 battle challenge to a specific user' })
  async challenge(
    @CurrentUser('userId') userId: string,
    @Body() dto: ChallengeDto,
  ) {
    return this.warService.challengeUser(userId, dto);
  }

  @Post('accept/:battleId')
  @ApiOperation({ summary: 'Accept direct battle challenge' })
  async accept(
    @CurrentUser('userId') userId: string,
    @Param('battleId') battleId: string,
  ) {
    return this.warService.acceptChallenge(userId, battleId);
  }

  @Post('reject/:battleId')
  @ApiOperation({ summary: 'Reject direct battle challenge' })
  async reject(
    @CurrentUser('userId') userId: string,
    @Param('battleId') battleId: string,
  ) {
    return this.warService.rejectChallenge(userId, battleId);
  }

  @Post('cancel/:battleId')
  @ApiOperation({ summary: 'Cancel a pending challenge you sent (challenger only)' })
  async cancel(
    @CurrentUser('userId') userId: string,
    @Param('battleId') battleId: string,
  ) {
    return this.warService.cancelChallenge(userId, battleId);
  }

  // ── Battle ──

  @Post('submit')
  @ApiOperation({ summary: 'Submit round answer during live battle' })
  async submitAnswer(
    @CurrentUser('userId') userId: string,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.warService.submitAnswer(userId, dto);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get current active battle session for logged in user' })
  async getActiveBattle(@CurrentUser('userId') userId: string) {
    return this.warService.getActiveBattle(userId);
  }

  @Get('resume')
  @ApiOperation({ summary: 'Get resume state (active battle snapshot, recently finished battle, or none) for a reconnecting user' })
  async resume(@CurrentUser('userId') userId: string) {
    return this.warService.buildResumePayload(userId);
  }

  @Get('pending-challenges')
  @ApiOperation({ summary: 'Get all incoming WAITING challenges where you are the opponent (player2)' })
  async getPendingChallenges(@CurrentUser('userId') userId: string) {
    return this.warService.getPendingChallenges(userId);
  }

  // ── Scheduled ──

  @Post('schedule')
  @ApiOperation({ summary: 'Schedule future battle' })
  async scheduleBattle(
    @CurrentUser('userId') userId: string,
    @Body() dto: ScheduleBattleDto,
  ) {
    return this.warService.scheduleBattle(userId, dto);
  }

  @Get('scheduled')
  @ApiOperation({ summary: 'List user scheduled battles' })
  async getScheduledBattles(@CurrentUser('userId') userId: string) {
    return this.warService.getScheduledBattles(userId);
  }

  @Post('cancel-scheduled/:battleId')
  @ApiOperation({ summary: 'Cancel a scheduled battle (either player can cancel)' })
  async cancelScheduled(
    @CurrentUser('userId') userId: string,
    @Param('battleId') battleId: string,
  ) {
    return this.warService.cancelScheduledBattle(userId, battleId);
  }

  // ── Search ──

  @Get('search-opponents')
  @ApiOperation({ summary: 'Search available opponents for battle challenge' })
  async searchOpponents(
    @CurrentUser('userId') userId: string,
    @Query('q') query: string = '',
    @Query('departmentId') departmentId?: string,
  ) {
    return this.warService.searchOpponents(userId, query, departmentId);
  }

  // ── Leaderboards ──

  @Get('dept-leaderboard')
  @ApiOperation({ summary: 'Get overall department rankings' })
  async getDeptLeaderboard() {
    return this.warService.getDeptLeaderboard();
  }

  @Get('user-leaderboard')
  @ApiOperation({ summary: 'Get individual player leaderboards' })
  async getUserLeaderboard(@Query('departmentId') departmentId?: string) {
    return this.warService.getUserLeaderboard(departmentId);
  }

  @Get('my-stats')
  @ApiOperation({ summary: 'Get current user war stats and record' })
  async getMyStats(@CurrentUser('userId') userId: string) {
    return this.warService.getUserWarStats(userId);
  }

  // ── History ──

  @Get('history')
  @ApiOperation({ summary: 'Get paginated battle history for current user' })
  async getHistory(
    @CurrentUser('userId') userId: string,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
  ) {
    return this.warService.getBattleHistory(
      userId,
      limit ? Number(limit) : 20,
      cursor,
    );
  }

  // ── Admin: Seed questions ──

  @Post('admin/seed')
  @ApiOperation({ summary: 'Seed single trivia question' })
  async seedQuestion(
    @Body()
    body: {
      questionText: string;
      options: string[];
      correctIndex: number;
      departmentId?: string;
      category?: string;
      difficulty?: string;
    },
  ) {
    return this.warService.seedQuestion(
      body.questionText,
      body.options,
      body.correctIndex,
      body.departmentId,
      body.category,
      body.difficulty,
    );
  }

  @Post('admin/seed-bulk')
  @ApiOperation({ summary: 'Bulk seed trivia questions' })
  async seedBulkQuestions(
    @Body()
    body: {
      questions: Array<{
        questionText: string;
        options: string[];
        correctIndex: number;
        departmentId?: string;
        category?: string;
        difficulty?: string;
      }>;
    },
  ) {
    return this.warService.seedBulkQuestions(body.questions);
  }
}