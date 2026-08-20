import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EventCategory } from './entities/event.entity';
import { UpdateEventDto } from './dto/update-event.dto';
import { PaginationDto } from './dto/pagination.dto';
import { RequirePerk } from '../gamification/decorators/require-perk.decorator';
import { PerkGuard } from '../gamification/guards/perk.guard';

@ApiTags('Events')
@Controller('events')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

@Get()
  @ApiOperation({ summary: 'Get all events for the current user school (Paginated)' })
  @ApiQuery({ name: 'category', enum: EventCategory, required: false })
  async findAll(
    @CurrentUser('userId') userId: string,
    @Query() paginationDto: PaginationDto,
    @Query('category') category?: EventCategory,
  ) {
    return this.eventsService.findAll(userId, paginationDto, category);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming events for the current user school (Paginated)' })
  async findUpcoming(
    @CurrentUser('userId') userId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.eventsService.findUpcoming(userId, paginationDto);
  }

  @Get('past')
  @ApiOperation({ summary: 'Get past events for the current user school (Paginated)' })
  async findPast(
    @CurrentUser('userId') userId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.eventsService.findPast(userId, paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single event details by ID' })
  async findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Post()
  @RequirePerk('Exclusive events')
  @UseGuards(PerkGuard)
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new campus event with optional image' })
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateEventDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.eventsService.create(userId, dto, file);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update an existing event' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.eventsService.update(userId, id, dto, file);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an event' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.eventsService.remove(userId, id);
  }

  @Patch(':id/rsvp')
  @ApiOperation({ summary: 'Toggle interest / RSVP for an event' })
  async toggleRsvp(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.eventsService.toggleRsvp(userId, id);
  }
}