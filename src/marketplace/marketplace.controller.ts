import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateMarketplaceDto } from './dto/create-marketplace.dto';
import { UpdateMarketplaceDto } from './dto/update-marketplace.dto';
import { MarketplaceService } from './marketplace.service';
import { mediaUploadOptions } from '../common/multer/media-upload.config';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Marketplace')
@Controller('marketplace')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

// ── Admin endpoints ─────────────────────────────────────────────

@Get('admin/all')
@UseGuards(AdminGuard)
@ApiOperation({ summary: 'List all marketplace items (admin)' })
async adminListAll() {
  return this.marketplaceService.adminListAll();
}

@Post('admin')
@UseGuards(AdminGuard)
@ApiOperation({ summary: 'Create marketplace item (admin)' })
async adminCreate(
  @CurrentUser('userId') userId: string,
  @Body() dto: CreateMarketplaceDto,
) {
  return this.marketplaceService.adminCreate(userId, dto);
}

@Patch('admin/:id')
@UseGuards(AdminGuard)
@ApiOperation({ summary: 'Update marketplace item (admin)' })
async adminUpdate(
  @Param('id') id: string,
  @Body() dto: UpdateMarketplaceDto,
) {
  return this.marketplaceService.adminUpdate(id, dto);
}

@Patch('admin/:id/toggle')
@UseGuards(AdminGuard)
@ApiOperation({ summary: 'Toggle marketplace item availability (admin)' })
async adminToggle(@Param('id') id: string) {
  return this.marketplaceService.adminToggleStatus(id);
}

@Delete('admin/:id')
@UseGuards(AdminGuard)
@ApiOperation({ summary: 'Delete marketplace item (admin)' })
async adminDelete(@Param('id') id: string) {
  await this.marketplaceService.adminDelete(id);
  return { success: true };
}

@Delete('admin')
@UseGuards(AdminGuard)
@ApiOperation({ summary: 'Bulk delete marketplace items (admin)' })
async adminBulkDelete(@Body() body: { ids: string[] }) {
  return this.marketplaceService.adminDeleteMany(body.ids);
}

// ── User endpoints ──────────────────────────────────────────────

  @Post()
  @UseInterceptors(AnyFilesInterceptor(mediaUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a marketplace item listing' })
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateMarketplaceDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.marketplaceService.create(userId, dto, files);
  }

@Get()
@ApiOperation({ summary: 'List all marketplace items with pagination, category filter, and search' })
@ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Page number' })
@ApiQuery({ name: 'limit', required: false, type: Number, example: 10, description: 'Items per page' })
@ApiQuery({ name: 'category', required: false, type: String, description: 'Filter items by category' })
@ApiQuery({ name: 'search', required: false, type: String, description: 'Search title, description, brand, or model' })
async findAll(
  @CurrentUser('userId') userId: string,
  @Query('page') page?: number,
  @Query('limit') limit?: number,
  @Query('category') category?: string,
  @Query('search') search?: string,
) {
  const user = await this.marketplaceService.getUserSchool(userId);

  return this.marketplaceService.findAll({
    schoolId: user?.schoolId,
    category,
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 20,
    search,
  });
}
  @Get(':id')
  @ApiOperation({ summary: 'Get a marketplace item by ID' })
  async findOne(@Param('id') id: string) {
    return this.marketplaceService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor(mediaUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update marketplace item' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMarketplaceDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.marketplaceService.update(userId, id, dto, files);
  }

  @Patch(':id/taken')
  @ApiOperation({ summary: 'Mark a marketplace item as taken' })
  async markAsTaken(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.marketplaceService.markAsTaken(userId, id);
  }

  @Patch(':id/available')
  @ApiOperation({ summary: 'Mark a marketplace item as available again' })
  async markAsAvailable(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.marketplaceService.markAsAvailable(userId, id);
  }

  @Patch(':id/unavailable')
  @ApiOperation({ summary: 'Mark a marketplace item as unavailable' })
  async markAsUnavailable(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.marketplaceService.markAsUnavailable(userId, id);
  }

  @Get(':id/contact')
  @ApiOperation({ summary: 'Get seller contact details for a marketplace item' })
  async getContactInfo(@Param('id') id: string) {
    return this.marketplaceService.getContactInfo(id);
  }

  @Patch(':id/like')
  @ApiOperation({ summary: 'Like or unlike a marketplace item' })
  async toggleLike(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.marketplaceService.toggleLike(userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a marketplace item' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    await this.marketplaceService.remove(userId, id);
    return { success: true };
  }
}
