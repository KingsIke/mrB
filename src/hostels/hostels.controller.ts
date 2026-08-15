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

@ApiTags('Hostels')
@Controller('hostels')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HostelsController {
  constructor(private readonly hostelsService: HostelsService) {}

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
