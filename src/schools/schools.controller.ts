import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
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
  @ApiResponse({ status: 200, description: 'List of schools', type: [School] })
  async findAll() {
    return this.schoolsService.findAll();
  }

  @Post('seed')
  @ApiOperation({ summary: 'Seed schools data (dev only)' })
  @ApiResponse({ status: 201, description: 'Schools seeded' })
  async seed() {
    await this.schoolsService.seedSchools();
    return { message: 'Schools seeded successfully' };
  }
}
