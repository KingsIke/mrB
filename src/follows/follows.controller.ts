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
