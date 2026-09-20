import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PuzzleService } from './puzzle.service';
import { SubmitScoreDto } from './dto/submit-score.dto';

@ApiTags('Puzzle')
@Controller('puzzle')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PuzzleController {
  constructor(private readonly puzzleService: PuzzleService) {}

  @Post('score')
  @ApiOperation({ summary: 'Submit a completed 2048 game score' })
  async submitScore(@CurrentUser('userId') userId: string, @Body() dto: SubmitScoreDto) {
    return this.puzzleService.submitScore(userId, dto.score, dto.highestTile);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my personal-best puzzle stats' })
  async getMyStats(@CurrentUser('userId') userId: string) {
    return this.puzzleService.getMyStats(userId);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Top 2048 high scores' })
  async getLeaderboard(@Query('limit') limit?: number) {
    return this.puzzleService.getLeaderboard(limit ? Number(limit) : undefined);
  }
}
