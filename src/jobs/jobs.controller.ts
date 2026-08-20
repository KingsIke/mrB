import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApplicationStatus } from './entities/job-application.entity';

@ApiTags('Jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Post a new job' })
  async create(@CurrentUser('userId') userId: string, @Body() body: any) {
    return this.jobsService.create(userId, body);
  }

  @Get()
  @ApiOperation({ summary: 'List all open jobs with filters' })
  async findAll(
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('schoolId') schoolId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.jobsService.findAll({
      q,
      type,
      status,
      schoolId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get('my-postings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my posted jobs' })
  async myPostings(@CurrentUser('userId') userId: string) {
    return this.jobsService.myPostings(userId);
  }

  @Get('my-applications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my job applications' })
  async myApplications(@CurrentUser('userId') userId: string) {
    return this.jobsService.myApplications(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a job by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a job' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @Body() body: any,
  ) {
    return this.jobsService.update(id, userId, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a job' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ) {
    await this.jobsService.remove(id, userId);
    return { success: true };
  }

  @Post(':id/apply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Apply to a job' })
  async apply(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @Body() body: { coverLetter?: string; resumeUrl?: string },
  ) {
    return this.jobsService.apply(id, userId, body);
  }

  @Get(':id/applications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get applications for a job (poster only)' })
  async getApplications(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.jobsService.getApplications(id, userId);
  }

  @Put('applications/:appId/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update application status' })
  async updateApplicationStatus(
    @Param('appId', ParseUUIDPipe) appId: string,
    @CurrentUser('userId') userId: string,
    @Body('status') status: ApplicationStatus,
  ) {
    return this.jobsService.updateApplicationStatus(appId, userId, status);
  }
}
