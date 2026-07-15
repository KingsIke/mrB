import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FacultiesService } from './faculties.service';
import { FacultyQueryDto } from './dto/faculty-query.dto';
import { Faculty } from './entities/faculty.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Faculties')
@Controller('faculties')
export class FacultiesController {
  constructor(private readonly facultiesService: FacultiesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get faculties for a school' })
  @ApiResponse({ status: 200, description: 'List of faculties', type: [Faculty] })
  async findAllBySchool(@Query() query: FacultyQueryDto) {
    return this.facultiesService.findAllBySchool(query.schoolId);
  }

  @Post('seed')
  @ApiOperation({ summary: 'Seed faculties data (dev only)' })
  @ApiResponse({ status: 201, description: 'Faculties seeded' })
  async seed() {
    await this.facultiesService.seedFaculties();
    return { message: 'Faculties seeded successfully' };
  }
}
