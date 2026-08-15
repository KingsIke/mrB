import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

// Deliberately mounted at `/users/:id/...` and `/users/me/blocked` (not `/users/:id`
// or `/users` alone) to avoid colliding with UsersController's route shapes.
@ApiTags('Follows')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Get(':id/is-following')
  @ApiOperation({ summary: 'Check if current user is following a target user' })
  async isFollowing(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') targetUserId: string,
  ) {
    const isFollowing = await this.followsService.isFollowing(currentUserId, targetUserId);
    return { isFollowing };
  }

  @Get(':id/is-blocked')
  @ApiOperation({ summary: 'Check if a block exists between current user and target user (either direction)' })
  async isBlocked(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') targetUserId: string,
  ) {
    const isBlocked = await this.followsService.isBlocked(currentUserId, targetUserId);
    return { isBlocked };
  }

  @Get(':id/is-blocker')
  @ApiOperation({ summary: 'Check if current user specifically blocked the target user' })
  async isBlocker(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') targetUserId: string,
  ) {
    const isBlocker = await this.followsService.isBlocker(currentUserId, targetUserId);
    return { isBlocked: isBlocker };
  }

  @Post(':id/follow')
  @ApiOperation({ summary: 'Follow a user' })
  async follow(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    await this.followsService.follow(userId, id);
    return { following: true };
  }

  @Delete(':id/follow')
  @ApiOperation({ summary: 'Unfollow a user' })
  async unfollow(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    await this.followsService.unfollow(userId, id);
    return { following: false };
  }

  @Get(':userId/followers')
  @ApiOperation({ summary: 'Get paginated followers of a target user' })
  async getFollowers(
    @Param('userId') targetUserId: string,
    @CurrentUser('userId') currentUserId: string,
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
  ) {
    return this.followsService.getFollowers(
      targetUserId,
      currentUserId,
      search,
      limit ? Number(limit) : 20,
      cursor,
    );
  }

  @Get(':userId/following')
  @ApiOperation({ summary: 'Get paginated users followed by a target user' })
  async getFollowing(
    @Param('userId') targetUserId: string,
    @CurrentUser('userId') currentUserId: string,
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
  ) {
    return this.followsService.getFollowing(
      targetUserId,
      currentUserId,
      search,
      limit ? Number(limit) : 20,
      cursor,
    );
  }

  @Post(':id/block')
  @ApiOperation({ summary: 'Block a user' })
  async block(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    await this.followsService.block(userId, id);
    return { blocked: true };
  }

  @Delete(':id/block')
  @ApiOperation({ summary: 'Unblock a user' })
  async unblock(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    await this.followsService.unblock(userId, id);
    return { blocked: false };
  }

  @Get('me/blocked')
  @ApiOperation({ summary: 'List users I have blocked' })
  async getBlocked(@CurrentUser('userId') userId: string) {
    return this.followsService.getBlockedUsers(userId);
  }
}