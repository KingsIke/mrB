import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StoriesService } from './stories.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateStoryDto } from './dto/create-story.dto';
import { ReactStoryDto } from './dto/react-story.dto';
import { ReplyStoryDto } from './dto/reply-story.dto';
import { mediaUploadOptions } from '../common/multer/media-upload.config';
import { RequirePerk } from '../gamification/decorators/require-perk.decorator';
import { PerkGuard } from '../gamification/guards/perk.guard';

@ApiTags('Stories')
@Controller('stories')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Post()
  @RequirePerk('Story highlights')
  @UseGuards(PerkGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('media', mediaUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a story (multipart or text)' })
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateStoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.storiesService.create(userId, dto, file);
  }

  @Get('feed')
  @ApiOperation({ summary: 'Get the story rail (unexpired stories, "Your Story" first)' })
  async getFeed(@CurrentUser('userId') userId: string) {
    return this.storiesService.getFeed(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'View a story' })
  async view(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.storiesService.view(userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete own story' })
  async remove(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    await this.storiesService.remove(userId, id);
  }

  @Post(':id/react')
  @ApiOperation({ summary: 'React to a story with an emoji' })
  async react(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() dto: ReactStoryDto) {
    const result = await this.storiesService.react(userId, id, dto.emoji);
    return { reacted: true, ...result };
  }

  @Delete(':id/react')
  @ApiOperation({ summary: 'Remove my reaction from a story' })
  async unreact(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    const result = await this.storiesService.unreact(userId, id);
    return { reacted: false, ...result };
  }

  @Post(':id/reply')
  @ApiOperation({ summary: 'Reply privately to a story' })
  async reply(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() dto: ReplyStoryDto) {
    return this.storiesService.reply(userId, id, dto.text);
  }

  @Get(':id/replies')
  @ApiOperation({ summary: 'List replies to my story (owner only)' })
  async getReplies(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.storiesService.getReplies(userId, id);
  }

  @Patch(':id/replies/read-all')
  @ApiOperation({ summary: 'Mark all replies to my story as read' })
  async markRepliesRead(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    await this.storiesService.markRepliesRead(userId, id);
    return { read: true };
  }

  @Patch(':id/highlight')
  @ApiOperation({ summary: 'Highlight my story' })
  async highlight(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.storiesService.highlight(userId, id);
  }
}
