import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post as HttpPost,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ReportContentDto } from './dto/report-content.dto';
import { CursorPaginationDto } from '../common/pagination/cursor-pagination.dto';
import { mediaUploadOptions } from '../common/multer/media-upload.config';

@ApiTags('Posts')
@Controller('posts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @HttpPost()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(FilesInterceptor('media', 20, mediaUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a post' })
  @ApiResponse({ status: 201, description: 'Post created' })
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreatePostDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.postsService.create(userId, dto, files);
  }

  @Get('drafts')
  @ApiOperation({ summary: 'List my draft posts' })
  async getDrafts(@CurrentUser('userId') userId: string) {
    return this.postsService.getDrafts(userId);
  }

  @Get('feed')
  @ApiOperation({ summary: 'Get feed (for-you | following | campus)' })
  async getFeed(@CurrentUser('userId') userId: string, @Query() query: FeedQueryDto) {
    return this.postsService.getFeed(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a post by ID' })
  async findById(@Param('id') id: string) {
    return this.postsService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit own post' })
  async update(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.postsService.update(userId, id, dto);
  }

  @Patch(':id/publish')
  @ApiOperation({ summary: 'Publish a draft post' })
  async publish(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.postsService.publish(userId, id);
  }

  @Patch(':id/hide')
  @ApiOperation({ summary: 'Hide own post' })
  async hide(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.postsService.hide(userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete own post' })
  async remove(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    await this.postsService.remove(userId, id);
  }

  @HttpPost(':id/like')
  @ApiOperation({ summary: 'Like a post' })
  async like(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    await this.postsService.likePost(userId, id);
    return { liked: true };
  }

  @Delete(':id/like')
  @ApiOperation({ summary: 'Unlike a post' })
  async unlike(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    await this.postsService.unlikePost(userId, id);
    return { liked: false };
  }

  @HttpPost(':id/comments')
  @ApiOperation({ summary: 'Comment on a post' })
  async addComment(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.postsService.addComment(userId, id, dto);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'List comments on a post' })
  async getComments(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.postsService.getComments(userId, id, pagination);
  }

  @HttpPost(':id/reshare')
  @ApiOperation({ summary: 'Reshare a post' })
  async reshare(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body('comment') comment?: string,
  ) {
    return this.postsService.reshare(userId, id, comment);
  }

  @HttpPost(':id/favorite')
  @ApiOperation({ summary: 'Add a post to favorites' })
  async favorite(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    await this.postsService.favorite(userId, id);
    return { favorited: true };
  }

  @Delete(':id/favorite')
  @ApiOperation({ summary: 'Remove a post from favorites' })
  async unfavorite(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    await this.postsService.unfavorite(userId, id);
    return { favorited: false };
  }

  @HttpPost(':id/report')
  @ApiOperation({ summary: 'Report a post' })
  async reportPost(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: ReportContentDto,
  ) {
    return this.postsService.reportPost(userId, id, dto.reason);
  }
}
