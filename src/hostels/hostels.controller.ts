import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateHostelDto } from './dto/create-hostel.dto';
import { UpdateHostelDto } from './dto/update-hostel.dto';
import { HostelsService } from './hostels.service';
import { mediaUploadOptions } from '../common/multer/media-upload.config';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Hostels')
@Controller('hostels')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HostelsController {
  constructor(private readonly hostelsService: HostelsService) {}

// ── Admin endpoints ─────────────────────────────────────────────

@Get('admin/all')
@UseGuards(AdminGuard)
@ApiOperation({ summary: 'List all hostel listings (admin)' })
async adminListAll() {
  return this.hostelsService.adminListAll();
}

@Post('admin')
@UseGuards(AdminGuard)
@ApiOperation({ summary: 'Create hostel listing (admin)' })
async adminCreate(
  @CurrentUser('userId') userId: string,
  @Body() dto: CreateHostelDto,
) {
  return this.hostelsService.adminCreate(userId, dto);
}

@Patch('admin/:id')
@UseGuards(AdminGuard)
@ApiOperation({ summary: 'Update hostel listing (admin)' })
async adminUpdate(
  @Param('id') id: string,
  @Body() dto: UpdateHostelDto,
) {
  return this.hostelsService.adminUpdate(id, dto);
}

@Patch('admin/:id/toggle')
@UseGuards(AdminGuard)
@ApiOperation({ summary: 'Toggle hostel listing availability (admin)' })
async adminToggle(@Param('id') id: string) {
  return this.hostelsService.adminToggleStatus(id);
}

@Delete('admin/:id')
@UseGuards(AdminGuard)
@ApiOperation({ summary: 'Delete hostel listing (admin)' })
async adminDelete(@Param('id') id: string) {
  await this.hostelsService.adminDelete(id);
  return { success: true };
}

@Delete('admin')
@UseGuards(AdminGuard)
@ApiOperation({ summary: 'Bulk delete hostel listings (admin)' })
async adminBulkDelete(@Body() body: { ids: string[] }) {
  return this.hostelsService.adminDeleteMany(body.ids);
}

// ── User endpoints ──────────────────────────────────────────────

  @Post()
  @UseInterceptors(AnyFilesInterceptor(mediaUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a hostel listing' })
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateHostelDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.hostelsService.create(userId, dto, files);
  }

  @Get()
  @ApiOperation({ summary: 'List all hostel listings for the current school' })
  async findAll(@CurrentUser('userId') userId: string) {
    const user = await this.hostelsService.getUserSchool(userId);
    return this.hostelsService.findAll(user?.schoolId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a hostel listing by ID' })
  async findOne(@Param('id') id: string) {
    return this.hostelsService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor(mediaUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update hostel listing' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateHostelDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.hostelsService.update(userId, id, dto, files);
  }

  @Patch(':id/taken')
  @ApiOperation({ summary: 'Mark a hostel listing as taken' })
  async markAsTaken(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.hostelsService.markAsTaken(userId, id);
  }

  @Patch(':id/available')
  @ApiOperation({ summary: 'Mark a hostel listing as available again' })
  async markAsAvailable(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.hostelsService.markAsAvailable(userId, id);
  }

  @Patch(':id/unavailable')
  @ApiOperation({ summary: 'Mark a hostel listing as unavailable' })
  async markAsUnavailable(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.hostelsService.markAsUnavailable(userId, id);
  }

  @Get(':id/contact')
  @ApiOperation({ summary: 'Get seller contact details for a hostel listing' })
  async getContactInfo(@Param('id') id: string) {
    return this.hostelsService.getContactInfo(id);
  }

  @Patch(':id/like')
  @ApiOperation({ summary: 'Like or unlike a hostel listing' })
  async toggleLike(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.hostelsService.toggleLike(userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a hostel listing' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    await this.hostelsService.remove(userId, id);
    return { success: true };
  }
}
