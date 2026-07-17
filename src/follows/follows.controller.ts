import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
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

  @Get(':id/followers')
  @ApiOperation({ summary: "List a user's followers" })
  async getFollowers(@Param('id') id: string) {
    return this.followsService.getFollowers(id);
  }

  @Get(':id/following')
  @ApiOperation({ summary: 'List who a user is following' })
  async getFollowing(@Param('id') id: string) {
    return this.followsService.getFollowing(id);
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
