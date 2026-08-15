import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AiService } from './ai.service';
import { ChatPromptDto } from './dto/chat-prompt.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('AI Assistant')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files', 5)) 
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Send a prompt or upload media (image/audio) to the AI assistant',
    description:
      'Generates an AI response for the user. Accepts optional images and audio files alongside prompt text.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'User message or prompt text',
          example: 'Describe this image or transcribe this audio',
        },
        chatId: {
          type: 'string',
          description: 'Optional chat session UUID to continue a conversation',
          example: 'a1b2c3d4-e5f6-7890-abcd-1234567890ab',
        },
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Optional array of image or audio files',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'AI response generated and message logged successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation error in request body or files.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not own this chat session.',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Provided chatId does not exist.',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error - Failed to process request with AI provider.',
  })
  async chat(
    @CurrentUser('userId') userId: string,
    @Body() dto: ChatPromptDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.aiService.generateResponse(dto.message, userId, dto.chatId, files);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user chat history',
    description:
      'Retrieves all previous chat sessions for the authenticated user to populate the recent chats list.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully fetched user chat history.',
  })
  async getUserHistory(@CurrentUser('userId') userId: string) {
    return this.aiService.getUserChatHistory(userId);
  }

  @Get('history/:chatId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get full message transcript for a chat session',
    description:
      'Retrieves all historical message exchanges associated with a specific chat session ID.',
  })
  @ApiParam({
    name: 'chatId',
    type: String,
    description: 'The UUID of the chat session to fetch',
    example: 'a1b2c3d4-e5f6-7890-abcd-1234567890ab',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved chat transcript.',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Chat session not found.',
  })
  async getChatMessages(@Param('chatId') chatId: string) {
    return this.aiService.getChatMessages(chatId);
  }

  @Delete('history/:chatId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a chat session',
    description:
      'Removes a specific chat session and all associated message transcripts for the authenticated user.',
  })
  @ApiParam({
    name: 'chatId',
    type: String,
    description: 'The UUID of the chat session to delete',
    example: 'a1b2c3d4-e5f6-7890-abcd-1234567890ab',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully deleted the chat session.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not own this chat session.',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Chat session not found.',
  })
  async deleteChatSession(
    @Param('chatId') chatId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.aiService.deleteChatSession(chatId, userId);
  }
}