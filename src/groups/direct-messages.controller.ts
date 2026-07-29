import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Direct Messages')
@Controller('dm')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DirectMessagesController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post(':userId')
  @ApiOperation({ summary: 'Start or fetch a 1:1 conversation with a user' })
  async start(@CurrentUser('userId') userId: string, @Param('userId') otherUserId: string) {
    return this.groupsService.getOrCreateDirectConversation(userId, otherUserId);
  }

  @Get()
  @ApiOperation({ summary: "List current user's direct-message conversations" })
  async list(@CurrentUser('userId') userId: string) {
    return this.groupsService.listDirectConversations(userId);
  }

  @Delete(':groupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hide a conversation from my own list (revives on new message)' })
  async hide(@CurrentUser('userId') userId: string, @Param('groupId') groupId: string) {
    await this.groupsService.hideConversation(userId, groupId);
  }
}
