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
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AddRecentSearchDto } from './dto/add-recent-search.dto';
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
  constructor(private readonly usersService: UsersService) {}

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
    return userWithoutPassword;
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

  @Get('search/recent')
  @ApiOperation({ summary: "Get user's recent search history" })
  async getRecentSearches(
    @CurrentUser('userId') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.getRecentSearches(userId, limit ? Number(limit) : 10);
  }

  @Post('search/recent')
  @ApiOperation({ summary: 'Record a user search click' })
  @ApiBody({ type: AddRecentSearchDto })
  async addRecentSearch(
    @CurrentUser('userId') userId: string,
    @Body() dto: AddRecentSearchDto,
  ) {
    return this.usersService.addRecentSearch(userId, dto.searchedUserId);
  }

  @Delete('search/recent/:searchedUserId')
  @ApiOperation({ summary: 'Delete a specific recent search entry' })
  @ApiParam({ name: 'searchedUserId', description: 'UUID of the searched user to remove' })
  async removeRecentSearch(
    @CurrentUser('userId') userId: string,
    @Param('searchedUserId', ParseUUIDPipe) searchedUserId: string,
  ) {
    return this.usersService.removeRecentSearch(userId, searchedUserId);
  }

  @Delete('search/recent')
  @ApiOperation({ summary: 'Clear all recent search entries' })
  async clearAllRecentSearches(@CurrentUser('userId') userId: string) {
    return this.usersService.clearAllRecentSearches(userId);
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
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { password, ...userWithoutPassword } = user;
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