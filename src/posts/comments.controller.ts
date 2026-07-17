import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ReportContentDto } from './dto/report-content.dto';

@ApiTags('Comments')
@Controller('comments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CommentsController {
  constructor(private readonly postsService: PostsService) {}

  @Post(':id/reply')
  @ApiOperation({ summary: 'Reply to a comment' })
  async reply(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() dto: CreateCommentDto) {
    return this.postsService.replyToComment(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a comment (own comment or own post)' })
  async remove(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    await this.postsService.deleteComment(userId, id);
  }

  @Post(':id/like')
  @ApiOperation({ summary: 'Like a comment' })
  async like(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    await this.postsService.likeComment(userId, id);
    return { liked: true };
  }

  @Delete(':id/like')
  @ApiOperation({ summary: 'Unlike a comment' })
  async unlike(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    await this.postsService.unlikeComment(userId, id);
    return { liked: false };
  }

  @Post(':id/report')
  @ApiOperation({ summary: 'Report a comment' })
  async report(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() dto: ReportContentDto) {
    return this.postsService.reportComment(userId, id, dto.reason);
  }
}
