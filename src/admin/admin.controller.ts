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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UpdateGiftDto } from './dto/update-gift.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateVerificationDto } from './dto/update-verification.dto';
import {
  AdminLeaderboardQueryDto,
  AdminTransactionQueryDto,
} from './dto/transaction-query.dto';
import { Gift } from '../gifts/entities/gift.entity';
import { User } from '../users/entities/user.entity';

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

  @Delete('stories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete any story (admin moderation)' })
  @ApiResponse({ status: 204, description: 'Story deleted' })
  async deleteStory(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.deleteStory(id);
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
}
