import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SchoolsService } from './schools.service';
import { School } from './entities/school.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Schools')
@Controller('schools')
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all schools' })
  @ApiQuery({
    name: 'type',
    required: false,
    description:
      "Filter by institution type: university | polytechnic | college_of_education | school_of_nursing | other",
  })
  @ApiResponse({ status: 200, description: 'List of schools', type: [School] })
  async findAll(@Query('type') type?: string) {
    return this.schoolsService.findAll(type);
  }

  @Post('seed')
  @ApiOperation({ summary: 'Seed schools data (dev only)' })
  @ApiResponse({ status: 201, description: 'Schools seeded' })
  async seed() {
    await this.schoolsService.seedSchools();
    return { message: 'Schools seeded successfully' };
  }
}
