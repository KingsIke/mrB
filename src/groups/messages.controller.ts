import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UploadedFiles, UseGuards, UseInterceptors} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SendMessageDto } from './dto/send-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { AddReactionDto } from './dto/add-reaction.dto';
import { CursorPaginationDto } from '../common/pagination/cursor-pagination.dto';
import { messageAttachmentUploadOptions } from '../common/multer/message-attachment-upload.config';

@ApiTags('Group Messages')
@Controller('groups/:groupId/messages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('pinned')
  @ApiOperation({ summary: 'Get the currently pinned message in a group' })
  async getPinned(
    @CurrentUser('userId') userId: string,
    @Param('groupId') groupId: string,
  ) {
    return this.messagesService.getPinnedMessage(userId, groupId);
  }

  @Get()
  @ApiOperation({ summary: 'List messages in a group (cursor paginated)' })
  async list(
    @CurrentUser('userId') userId: string,
    @Param('groupId') groupId: string,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.messagesService.listMessages(userId, groupId, pagination);
  }

  @Post()
  @UseInterceptors(FilesInterceptor('attachments', 5, messageAttachmentUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Send a message (text and/or attachments)' })
  async send(
    @CurrentUser('userId') userId: string,
    @Param('groupId') groupId: string,
    @Body() dto: SendMessageDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.messagesService.sendMessage(userId, groupId, dto, files);
  }

  @Patch(':messageId')
  @ApiOperation({ summary: 'Edit own message (within the edit window)' })
  async edit(
    @CurrentUser('userId') userId: string,
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.messagesService.editMessage(userId, messageId, dto);
  }

  @Delete(':messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a message (own message, or any message as group admin)' })
  async remove(@CurrentUser('userId') userId: string, @Param('messageId') messageId: string) {
    await this.messagesService.deleteMessage(userId, messageId);
  }

  @Post(':messageId/reactions')
  @ApiOperation({ summary: 'React to a message with an emoji (replaces your existing reaction)' })
  async addReaction(
    @CurrentUser('userId') userId: string,
    @Param('messageId') messageId: string,
    @Body() dto: AddReactionDto,
  ) {
    return this.messagesService.addReaction(userId, messageId, dto);
  }

  @Delete(':messageId/reactions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove your own reaction from a message' })
  async removeReaction(@CurrentUser('userId') userId: string, @Param('messageId') messageId: string) {
    await this.messagesService.removeReaction(userId, messageId);
  }

  @Patch(':messageId/pin')
  @ApiOperation({ summary: 'Pin a message (admin only) — shows at top of chat for everyone' })
  async pinMessage(
    @CurrentUser('userId') userId: string,
    @Param('groupId') groupId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.pinMessage(userId, groupId, messageId);
  }

  @Delete(':messageId/pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unpin a message (admin only)' })
  async unpinMessage(
    @CurrentUser('userId') userId: string,
    @Param('groupId') groupId: string,
    @Param('messageId') messageId: string,
  ) {
    await this.messagesService.unpinMessage(userId, groupId, messageId);
  }
}
