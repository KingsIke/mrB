import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GamificationService, LeaderboardScope } from './gamification.service';
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

@Get('leaderboard/givers')
  @ApiOperation({
    summary: 'Get top givers leaderboard',
    description:
      'Retrieves the leaderboard of top gift senders scoped by department, faculty, school, or global app level.',
  })
  @ApiQuery({
    name: 'scope',
    enum: LeaderboardScope,
    required: false,
    example: LeaderboardScope.APP,
    description: 'The scope of the leaderboard (department, faculty, school, app)',
  })
  @ApiQuery({
    name: 'departmentId',
    type: String,
    required: false,
    description: 'Required if scope is set to "department"',
  })
  @ApiQuery({
    name: 'facultyId',
    type: String,
    required: false,
    description: 'Required if scope is set to "faculty"',
  })
  @ApiQuery({
    name: 'schoolId',
    type: String,
    required: false,
    description: 'Required if scope is set to "school"',
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    example: 20,
    description: 'Number of top givers to return (default: 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully fetched top givers leaderboard.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Missing scope target ID (e.g. departmentId).',
  })
  async getGiverLeaderboard(
    @Query('scope') scope: LeaderboardScope = LeaderboardScope.APP,
    @Query('departmentId') departmentId?: string,
    @Query('facultyId') facultyId?: string,
    @Query('schoolId') schoolId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.gamificationService.getGiverLeaderboard({
      scope,
      departmentId,
      facultyId,
      schoolId,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Post('seed-levels')
  @ApiOperation({ summary: 'Seed the level table (dev only)' })
  async seedLevels() {
    await this.gamificationService.seedLevels();
    return { message: 'Levels seeded successfully' };
  }

  // ========== Admin Level Management ==========

  @Get('admin/levels')
  @ApiOperation({ summary: 'Admin: Get all levels' })
  async adminGetLevels() {
    return this.gamificationService.getLevels();
  }

  @Post('admin/levels')
  @ApiOperation({ summary: 'Admin: Create a new level' })
  async adminCreateLevel(@Body() body: {
    level: number;
    title: string;
    emoji: string;
    minXp: number;
    maxXp?: number | null;
    badge: string;
    color: string;
    rewardCoins?: number;
    perks?: string[];
  }) {
    return this.gamificationService.createLevel(body);
  }

  @Patch('admin/levels/:id')
  @ApiOperation({ summary: 'Admin: Update a level' })
  async adminUpdateLevel(
    @Param('id') id: string,
    @Body() body: Partial<{
      level: number;
      title: string;
      emoji: string;
      minXp: number;
      maxXp?: number | null;
      badge: string;
      color: string;
      rewardCoins: number;
      perks: string[];
    }>
  ) {
    return this.gamificationService.updateLevel(id, body);
  }

  @Delete('admin/levels/:id')
  @ApiOperation({ summary: 'Admin: Delete a level' })
  async adminDeleteLevel(@Param('id') id: string) {
    await this.gamificationService.deleteLevel(id);
    return { message: 'Level deleted successfully' };
  }
}
