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
import { Throttle } from '@nestjs/throttler';
import { NotesService } from './notes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@ApiTags('Notes')
@Controller('notes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a new note' })
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.notesService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List user notes with optional search and category filter' })
  async findAll(
    @CurrentUser('userId') userId: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    return this.notesService.findAll(userId, search, category);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single note by ID' })
  async findOne(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.notesService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing note' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notesService.update(userId, id, dto);
  }

  @Patch(':id/toggle-pin')
  @ApiOperation({ summary: 'Toggle pinned status on a note' })
  async togglePin(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.notesService.togglePin(userId, id);
  }

  @Patch(':id/toggle-bookmark')
  @ApiOperation({ summary: 'Toggle bookmarked status on a note' })
  async toggleBookmark(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.notesService.toggleBookmark(userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a note' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    await this.notesService.remove(userId, id);
    return { success: true };
  }
}