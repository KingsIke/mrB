import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';
import { UpdateGiftDto } from './dto/update-gift.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateVerificationDto } from './dto/update-verification.dto';
import {
  AdminLeaderboardQueryDto,
  AdminTransactionQueryDto,
} from './dto/transaction-query.dto';
import { PastQuestionAnalyticsQueryDto } from './dto/past-question-analytics.dto';
import { Gift } from '../gifts/entities/gift.entity';
import { User } from '../users/entities/user.entity';
import { Job } from '../jobs/entities/job.entity';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ------------------------------------------------------------------
  // Users
  // ------------------------------------------------------------------

  @Patch('users/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate or suspend a user (admin)' })
  @ApiResponse({ status: 200, description: 'User status updated', type: User })
  setUserStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.setUserStatus(id, dto);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a user (admin)' })
  @ApiResponse({ status: 204, description: 'User deactivated' })
  async deleteUser(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.deleteUser(id);
  }

  // ------------------------------------------------------------------
  // Bulk user actions
  // ------------------------------------------------------------------

  @Patch('users/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk set user status (admin)' })
  @ApiResponse({ status: 200, description: 'Bulk status result' })
  async bulkSetUserStatus(@Body() body: { ids: string[]; status: string }) {
    return this.adminService.bulkSetUserStatus(body.ids, body.status);
  }

  @Delete('users')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk soft-delete users (admin)' })
  @ApiResponse({ status: 200, description: 'Bulk delete result' })
  async bulkDeleteUsers(@Body() body: { ids: string[] }) {
    return this.adminService.bulkDeleteUsers(body.ids);
  }

  @Patch('users/verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk set verification status (admin)' })
  @ApiResponse({ status: 200, description: 'Bulk verification result' })
  async bulkSetVerification(@Body() body: { ids: string[]; status: string }) {
    return this.adminService.bulkSetVerification(body.ids, body.status);
  }

  // ------------------------------------------------------------------
  // Student verification
  // ------------------------------------------------------------------

  @Get('verifications')
  @ApiOperation({ summary: 'List users with verification documents (admin)' })
  @ApiResponse({ status: 200, description: 'Verification queue', type: [User] })
  async listVerifications() {
    const users = await this.adminService.listVerifications();
    return users.map(({ password, ...rest }) => rest);
  }

  @Patch('users/:id/verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve or reject a student verification (admin)' })
  @ApiResponse({ status: 200, description: 'Verification updated', type: User })
  updateVerification(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVerificationDto,
  ) {
    return this.adminService.updateVerification(id, dto);
  }

  // ------------------------------------------------------------------
  // Gifts
  // ------------------------------------------------------------------

  @Get('gifts')
  @ApiOperation({ summary: 'List all gifts including inactive (admin)' })
  @ApiResponse({ status: 200, description: 'All gifts', type: [Gift] })
  listAllGifts() {
    return this.adminService.listAllGifts();
  }

  @Patch('gifts/:id')
  @ApiOperation({ summary: 'Update a gift (admin)' })
  @ApiResponse({ status: 200, description: 'Gift updated', type: Gift })
  updateGift(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGiftDto,
  ) {
    return this.adminService.updateGift(id, dto);
  }

  @Delete('gifts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a gift (admin). Deactivates it if already used.' })
  @ApiResponse({ status: 204, description: 'Gift deleted' })
  async deleteGift(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.deleteGift(id);
  }

  @Delete('gifts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk delete gifts (admin)' })
  @ApiResponse({ status: 200, description: 'Bulk delete results' })
  async deleteGifts(@Body() body: { ids: string[] }) {
    return this.adminService.deleteGifts(body.ids);
  }

  // ------------------------------------------------------------------
  // Posts & Stories (moderation)
  // ------------------------------------------------------------------

  @Delete('posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete any post (admin moderation)' })
  @ApiResponse({ status: 204, description: 'Post deleted' })
  async deletePost(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.deletePost(id);
  }

  @Patch('posts/:id/hide')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hide/unhide a post (admin moderation)' })
  @ApiResponse({ status: 200, description: 'Post hidden status toggled' })
  async hidePost(@Param('id', ParseUUIDPipe) id: string, @Body() body: { isHidden: boolean }) {
    return this.adminService.hidePost(id, body.isHidden);
  }

  @Delete('posts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk delete posts (admin)' })
  @ApiResponse({ status: 200, description: 'Bulk delete result' })
  async bulkDeletePosts(@Body() body: { ids: string[] }) {
    return this.adminService.bulkDeletePosts(body.ids);
  }

  @Patch('posts/hide')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk hide/unhide posts (admin)' })
  @ApiResponse({ status: 200, description: 'Bulk hide result' })
  async bulkHidePosts(@Body() body: { ids: string[]; isHidden: boolean }) {
    return this.adminService.bulkHidePosts(body.ids, body.isHidden);
  }

  @Delete('stories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete any story (admin moderation)' })
  @ApiResponse({ status: 204, description: 'Story deleted' })
  async deleteStory(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.deleteStory(id);
  }

  @Patch('stories/:id/hide')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hide/unhide a story (admin moderation)' })
  @ApiResponse({ status: 200, description: 'Story hidden status toggled' })
  async hideStory(@Param('id', ParseUUIDPipe) id: string, @Body() body: { isHidden: boolean }) {
    return this.adminService.hideStory(id, body.isHidden);
  }

  @Delete('stories')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk delete stories (admin)' })
  @ApiResponse({ status: 200, description: 'Bulk delete result' })
  async bulkDeleteStories(@Body() body: { ids: string[] }) {
    return this.adminService.bulkDeleteStories(body.ids);
  }

  @Patch('stories/hide')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk hide/unhide stories (admin)' })
  @ApiResponse({ status: 200, description: 'Bulk hide result' })
  async bulkHideStories(@Body() body: { ids: string[]; isHidden: boolean }) {
    return this.adminService.bulkHideStories(body.ids, body.isHidden);
  }

  // ------------------------------------------------------------------
  // Jobs
  // ------------------------------------------------------------------

  @Post('jobs')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a job posting (admin)' })
  @ApiResponse({ status: 201, description: 'Job created', type: Job })
  createJob(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateJobDto,
  ) {
    return this.adminService.createJob(userId, dto);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List all jobs with filters (admin)' })
  @ApiResponse({ status: 200, description: 'Paginated job list' })
  listJobs(
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('schoolId') schoolId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listJobs({
      q,
      type,
      status,
      schoolId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Patch('jobs/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a job (admin)' })
  @ApiResponse({ status: 200, description: 'Job updated', type: Job })
  updateJob(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobDto,
  ) {
    return this.adminService.updateJob(id, dto);
  }

  @Patch('jobs/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update job status (admin)' })
  @ApiResponse({ status: 200, description: 'Job status updated', type: Job })
  updateJobStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobStatusDto,
  ) {
    return this.adminService.updateJobStatus(id, dto);
  }

  @Delete('jobs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a job (admin)' })
  @ApiResponse({ status: 204, description: 'Job deleted' })
  async deleteJob(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.deleteJob(id);
  }

  @Get('jobs/:id/applications')
  @ApiOperation({ summary: 'List all applications for a job (admin)' })
  @ApiResponse({ status: 200, description: 'Job applications' })
  getJobApplications(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getJobApplications(id);
  }

  @Patch('jobs/applications/:appId/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update any job application status (admin)' })
  @ApiResponse({ status: 200, description: 'Application status updated' })
  updateJobApplicationStatus(
    @Param('appId', ParseUUIDPipe) appId: string,
    @Body('status') status: string,
  ) {
    return this.adminService.updateJobApplicationStatus(appId, status);
  }

  @Patch('jobs/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk update job status (admin)' })
  @ApiResponse({ status: 200, description: 'Bulk status update result' })
  async bulkUpdateJobStatus(@Body() body: { ids: string[]; status: string }) {
    return this.adminService.bulkUpdateJobStatus(body.ids, body.status as any);
  }

  @Delete('jobs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk delete jobs (admin)' })
  @ApiResponse({ status: 200, description: 'Bulk delete result' })
  async bulkDeleteJobs(@Body() body: { ids: string[] }) {
    return this.adminService.bulkDeleteJobs(body.ids);
  }

  @Get('jobs/stats')
  @ApiOperation({ summary: 'Get job dashboard statistics (admin)' })
  @ApiResponse({ status: 200, description: 'Job stats and recent postings' })
  getJobStats() {
    return this.adminService.getJobStats();
  }

  // ------------------------------------------------------------------
  // Transaction analytics
  // ------------------------------------------------------------------

  @Get('transactions/top-purchasers')
  @ApiOperation({ summary: 'Top users by coins purchased (admin)' })
  @ApiResponse({ status: 200, description: 'Leaderboard of top coin purchasers' })
  getTopPurchasers(@Query() query: AdminLeaderboardQueryDto) {
    return this.adminService.getTopPurchasers(query.limit);
  }

  @Get('transactions/top-recipients')
  @ApiOperation({ summary: 'Top users by gifts received (admin)' })
  @ApiResponse({ status: 200, description: 'Leaderboard of top gift recipients' })
  getTopGiftRecipients(@Query() query: AdminLeaderboardQueryDto) {
    return this.adminService.getTopGiftRecipients(query.limit);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'All user transaction history (admin)' })
  @ApiResponse({ status: 200, description: 'Paginated transaction feed' })
  getTransactions(@Query() query: AdminTransactionQueryDto) {
    return this.adminService.getTransactions(query);
  }

  // ------------------------------------------------------------------
  // Past question analytics
  // ------------------------------------------------------------------

  @Get('analytics/past-questions')
  @ApiOperation({ summary: 'Past question upload analytics (admin)' })
  @ApiResponse({ status: 200, description: 'Past question stats, top uploaders, and recent uploads' })
  getPastQuestionAnalytics(@Query() query: PastQuestionAnalyticsQueryDto) {
    return this.adminService.getPastQuestionAnalytics(query);
  }
}
