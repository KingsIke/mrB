import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectTopicsService } from './project-topics.service';
import { CreateProjectTopicDto } from './dto/create-project-topic.dto';
import { ListProjectTopicsDto } from './dto/list-project-topics.dto';

@ApiTags('ProjectTopics')
@Controller('project-topics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProjectTopicsController {
  constructor(private readonly ptService: ProjectTopicsService) {}

  // ── Create ──────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new project topic' })
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateProjectTopicDto,
  ) {
    return this.ptService.create(userId, dto);
  }

  // ── Seed ───────────────────────────────────────────────────────

  @Post('seed')
  @ApiOperation({ summary: 'Seed project topics into departments (dev only)' })
  async seed() {
    return this.ptService.seedProjectTopics();
  }

  // ── List ────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List project topics (paginated, with optional filters)' })
  async list(
    @CurrentUser('userId') userId: string,
    @Query() dto: ListProjectTopicsDto,
  ) {
    return this.ptService.list(dto, userId);
  }

  @Get('department')
  @ApiOperation({ summary: 'List project topics in my department' })
  async listDepartment(
    @CurrentUser('userId') userId: string,
    @Query() dto: ListProjectTopicsDto,
  ) {
    return this.ptService.listByDepartment(userId, dto);
  }

  // ── Read ────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get a single project topic' })
  async find(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ptService.findById(id, userId);
  }

  // ── Update ──────────────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project topic (author only)' })
  async update(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateProjectTopicDto,
  ) {
    return this.ptService.update(id, userId, dto);
  }

  // ── Delete ──────────────────────────────────────────────────────

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a project topic (author only)' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ptService.remove(id, userId);
  }

  // ── Voting (with tracking) ──────────────────────────────────────

  @Post(':id/upvote')
  @ApiOperation({ summary: 'Upvote a project topic (toggle)' })
  async upvote(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ptService.upvote(userId, id);
  }

  @Post(':id/downvote')
  @ApiOperation({ summary: 'Downvote a project topic (toggle)' })
  async downvote(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ptService.downvote(userId, id);
  }
}
