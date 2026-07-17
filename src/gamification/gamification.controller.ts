import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GamificationService } from './gamification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Gamification')
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my XP, level, and progress' })
  async getMe(@CurrentUser('userId') userId: string) {
    return this.gamificationService.getMe(userId);
  }

  @Get('levels')
  @ApiOperation({ summary: 'Get the 15-level table' })
  async getLevels() {
    return this.gamificationService.getLevels();
  }

  @Get('leaderboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiQuery({ name: 'type', enum: ['givers'], required: false })
  @ApiOperation({ summary: 'Top givers leaderboard' })
  async getLeaderboard() {
    return this.gamificationService.getGiverLeaderboard();
  }

  @Post('seed-levels')
  @ApiOperation({ summary: 'Seed the level table (dev only)' })
  async seedLevels() {
    await this.gamificationService.seedLevels();
    return { message: 'Levels seeded successfully' };
  }
}
