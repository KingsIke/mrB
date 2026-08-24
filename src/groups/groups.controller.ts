import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch,  Post, UploadedFile, UseGuards, UseInterceptors} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { LockGroupDto } from './dto/lock-group.dto';
import { MuteGroupDto } from './dto/mute-group.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { mediaUploadOptions } from '../common/multer/media-upload.config';

@ApiTags('Groups')
@Controller('groups')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('icon', mediaUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a custom group (caller becomes admin)' })
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateGroupDto,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    return this.groupsService.createGroup(userId, dto, icon);
  }

  @Get()
  @ApiOperation({ summary: "List current user's groups" })
  async listMine(@CurrentUser('userId') userId: string) {
    return this.groupsService.listUserGroups(userId);
  }

  @Get('default')
  @ApiOperation({ summary: 'List all default/preset interest groups' })
  async getDefaultGroups() {
    return this.groupsService.getDefaultGroups();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get group detail' })
  async findById(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.groupsService.getGroupDetail(userId, id);
  }


  @Post('seed')
   @ApiOperation({ summary: 'Seed Groups data (dev only)' })
   @ApiResponse({ status: 201, description: 'Groups seeded' })
  async seedGroups() {
    await this.groupsService.seedDefaultGroups();
    return { message: 'Default groups seeded successfully' };
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all messages in a group or DM as read' })
  async markAsRead(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    await this.groupsService.markAsRead(userId, id);
    return { success: true };
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('icon', mediaUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update group name/icon/description (any member; blocked for official groups)' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    return this.groupsService.updateGroupSettings(userId, id, dto, icon);
  }

  @Patch(':id/lock')
  @ApiOperation({ summary: 'Lock/unlock messaging (admin only, announcement mode)' })
  async lock(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() dto: LockGroupDto) {
    return this.groupsService.lockMessages(userId, id, dto);
  }

  @Patch(':id/mute')
  @ApiOperation({ summary: 'Mute/unmute notifications for this group' })
  async mute(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() dto: MuteGroupDto) {
    return this.groupsService.setMute(userId, id, dto.isMuted);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List group members' })
  async listMembers(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.groupsService.listMembers(userId, id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add a member (admin only)' })
  async addMember(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.groupsService.addMember(userId, id, dto.userId);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member (admin only)' })
  async removeMember(
    @CurrentUser('userId') actingUserId: string,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    await this.groupsService.removeMember(actingUserId, id, targetUserId);
  }

  @Patch(':id/members/:targetUserId/promote')
  @ApiOperation({ summary: 'Promote a member to admin (admin only)' })
  async promoteMember(
    @CurrentUser('userId') actingUserId: string,
    @Param('id') id: string,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.groupsService.promoteMember(actingUserId, id, targetUserId);
  }

  @Patch(':id/members/:targetUserId/demote')
  @ApiOperation({ summary: 'Demote an admin to member (admin only)' })
  async demoteMember(
    @CurrentUser('userId') actingUserId: string,
    @Param('id') id: string,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.groupsService.demoteMember(actingUserId, id, targetUserId);
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave a custom group (blocked for official groups)' })
  async leave(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    await this.groupsService.leaveGroup(userId, id);
  }

  @Post(':id/join')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Join a default interest group or public group' })
async joinGroup(
  @CurrentUser('userId') userId: string,
  @Param('id') id: string,
) {
  return this.groupsService.joinGroup(userId, id);
}
} 