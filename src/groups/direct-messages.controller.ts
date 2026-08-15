import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { StreamClient } from '@stream-io/node-sdk'; 
import { GroupsService } from './groups.service';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('Direct Messages')
@Controller('dm')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DirectMessagesController {
  private streamClient!: StreamClient;

  constructor(
    private readonly groupsService: GroupsService,
    private readonly messagesService: MessagesService,
  ) {
    this.initStreamClient();
  }

  private initStreamClient(): StreamClient {
    if (!this.streamClient) {
      const apiKey = process.env.STREAM_API_KEY || 'bkf7p9ge32g9';
      const apiSecret = process.env.STREAM_API_SECRET;

      if (!apiSecret) {
        throw new InternalServerErrorException(
          'STREAM_API_SECRET is not configured in .env',
        );
      }
      this.streamClient = new StreamClient(apiKey, apiSecret);
    }
    return this.streamClient;
  }

  @Get('token')
  @ApiOperation({ summary: 'Generate Stream Video/Audio user token and register caller' })
  async getStreamToken(@CurrentUser('userId') userId: string) {
    const client = this.initStreamClient();

    // 1. Ensure current user is created/updated in Stream's database
    await client.upsertUsers([
      {
        id: userId,
        role: 'user',
      },
    ]);

    // 2. Generate a valid JWT token signed by your Stream Secret
    const token = client.generateUserToken({ user_id: userId });

    return { token };
  }

  @Post('users/sync')
  @ApiOperation({ summary: 'Ensure a target call recipient exists in Stream before starting a call' })
  async syncUser(@Body() body: { userId: string; name?: string }) {
    const client = this.initStreamClient();

    // Upsert target user so call creation won't fail with "user does not exist"
    await client.upsertUsers([
      {
        id: body.userId,
        name: body.name || 'User',
        role: 'user',
      },
    ]);

    return { success: true };
  }

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

  @Get(':groupId/messages')
  @ApiOperation({ summary: 'Get cursor-paginated message history for a 1:1 conversation' })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMessages(
    @CurrentUser('userId') userId: string,
    @Param('groupId') groupId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit = 20,
  ) {
    return this.messagesService.listMessages(userId, groupId, {
      cursor,
      limit: +limit,
    });
  }

  @Post(':groupId/messages')
  @UseInterceptors(FilesInterceptor('files'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Send a message (with optional file attachments) in a 1:1 conversation' })
  async sendMessage(
    @CurrentUser('userId') userId: string,
    @Param('groupId') groupId: string,
    @Body() dto: SendMessageDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.messagesService.sendMessage(userId, groupId, dto, files);
  }

  @Post(':groupId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark direct conversation as read' })
  async markAsRead(@CurrentUser('userId') userId: string, @Param('groupId') groupId: string) {
    await this.groupsService.markAsRead(userId, groupId);
  }

  @Delete(':groupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hide a conversation from my own list' })
  async hide(@CurrentUser('userId') userId: string, @Param('groupId') groupId: string) {
    await this.groupsService.hideConversation(userId, groupId);
  }
}