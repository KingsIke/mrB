import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  UploadedFile,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { GamificationService } from '../gamification/gamification.service';
import { StreamService } from './stream.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePrivacyDto } from './dto/update-privacy.dto';
import { User } from './entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { memoryStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly gamificationService: GamificationService,
    private readonly streamService: StreamService,
  ) {}

  // --------------------------------------------------------------------------
  // 👤 PROFILE / ME ROUTES
  // --------------------------------------------------------------------------

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile', type: User })
  async getMe(@CurrentUser('userId') userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { password, ...userWithoutPassword } = user;

    // Attach level perks so the frontend knows what features are unlocked
    const perks = await this.gamificationService.getLevelPerks(userId);
    return { ...userWithoutPassword, perks };
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Get current user profile statistics' })
  @ApiResponse({
    status: 200,
    description: 'Counts of posts, likes, followers, following, and gifts for current user',
  })
  async getMyStats(@CurrentUser('userId') userId: string) {
    return this.usersService.getUserStats(userId);
  }

  @Get('me/privacy')
  @ApiOperation({ summary: 'Get current user privacy settings' })
  @ApiResponse({ status: 200, description: 'Privacy settings' })
  async getMyPrivacy(@CurrentUser('userId') userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      privateProfile: user.privateProfile,
      onlineStatus: user.onlineStatus,
      readReceipts: user.readReceipts,
      activityStatus: user.activityStatus,
      dataSharing: user.dataSharing,
    };
  }

  @Patch('me/privacy')
  @ApiOperation({ summary: 'Update current user privacy settings' })
  @ApiResponse({ status: 200, description: 'Updated privacy settings' })
  @ApiBody({ type: UpdatePrivacyDto })
  async updateMyPrivacy(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdatePrivacyDto,
  ) {
    const user = await this.usersService.updatePrivacy(userId, dto);
    return {
      privateProfile: user.privateProfile,
      onlineStatus: user.onlineStatus,
      readReceipts: user.readReceipts,
      activityStatus: user.activityStatus,
      dataSharing: user.dataSharing,
    };
  }

  @Patch('me')
  @UseInterceptors(
    FileInterceptor('profilePicture', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, callback) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new Error('Only image files (JPEG, PNG, WebP) are allowed'), false);
        }
      },
    }),
  )
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiConsumes('multipart/form-data', 'application/json')
  async updateMe(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const user = await this.usersService.updateProfile(userId, dto, file);
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // --------------------------------------------------------------------------
  // 📹 STREAM VIDEO CALL ROUTES
  // --------------------------------------------------------------------------

  @Post('stream/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a Stream Video token for the current user' })
  @ApiResponse({ status: 200, description: 'Stream token and API key' })
  async getStreamToken(@CurrentUser('userId') userId: string) {
    const result = await this.streamService.generateToken(userId);
    if (!result) {
      throw new NotFoundException('Could not generate Stream token');
    }
    return result;
  }

  @Post('stream/register-device')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register a device for Stream push notifications' })
  @ApiBody({ schema: { properties: { pushToken: { type: 'string' }, provider: { type: 'string', enum: ['apn', 'firebase'] } } } })
  async registerStreamDevice(
    @CurrentUser('userId') userId: string,
    @Body() body: { pushToken: string; provider?: 'apn' | 'firebase' },
  ) {
    return this.streamService.registerDevice(userId, body.pushToken, body.provider || 'firebase');
  }

  @Post('stream/remove-device')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a device from Stream push notifications' })
  @ApiBody({ schema: { properties: { pushToken: { type: 'string' } } } })
  async removeStreamDevice(
    @CurrentUser('userId') userId: string,
    @Body() body: { pushToken: string },
  ) {
    return this.streamService.removeDevice(userId, body.pushToken);
  }

  // --------------------------------------------------------------------------
  // 🔍 SEARCH & DISCOVERY ROUTES
  // --------------------------------------------------------------------------

  @Get('search')
  @ApiOperation({ summary: 'Search users by username or name' })
  async searchUsers(
    @CurrentUser('userId') userId: string,
    @Query('q') query: string,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.searchUsers(query, userId, limit ? Number(limit) : 10);
  }

  @Get('trending')
  @ApiOperation({ summary: 'Get trending users' })
  async getTrendingUsers(
    @CurrentUser('userId') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.getTrendingUsers(userId, limit ? Number(limit) : 10);
  }

  @Get('suggested')
  @ApiOperation({ summary: 'Get suggested users' })
  async getSuggestedUsers(
    @CurrentUser('userId') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.getSuggestedUsers(userId, limit ? Number(limit) : 10);
  }

  // --------------------------------------------------------------------------
  // 📋 ADMIN / GENERAL USER MANAGEMENT
  // --------------------------------------------------------------------------

  @Get()
  @ApiOperation({ summary: 'Get all users (admin)' })
  @ApiResponse({ status: 200, description: 'List of users', type: [User] })
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map((user) => {
      const { password, ...rest } = user;
      return rest;
    });
  }

  // --------------------------------------------------------------------------
  // 🆔 PARAMETERIZED ROUTES (:id MUST BE AT THE BOTTOM)
  // --------------------------------------------------------------------------

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get user profile statistics by user ID' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: 200,
    description: 'Counts of posts, likes, followers, following, and gifts',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getUserStats(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User found', type: User })
  async findOne(
    @CurrentUser('userId') requesterId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { password, ...userWithoutPassword } = user;

    // Private profiles are only visible to the owner and their followers
    if (user.privateProfile && requesterId !== user.id) {
      const isFollowing = await this.usersService.isFollowing(requesterId, user.id);
      if (!isFollowing) {
        return {
          ...userWithoutPassword,
          isPrivateProfile: true,
          // Do not expose profile details of a private account to non-followers
          firstName: undefined,
          lastName: undefined,
          bio: undefined,
          email: undefined,
          phoneNumber: undefined,
          dateOfBirth: undefined,
          school: undefined,
          faculty: undefined,
          department: undefined,
        };
      }
    }

    return userWithoutPassword;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 204, description: 'User deleted' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.remove(id);
  }
}