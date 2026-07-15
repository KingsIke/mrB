import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { DepartmentQueryDto } from './dto/department-query.dto';
import { Department } from './entities/department.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Departments')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get departments for a faculty' })
  @ApiResponse({ status: 200, description: 'List of departments', type: [Department] })
  async findAllByFaculty(@Query() query: DepartmentQueryDto) {
    return this.departmentsService.findAllByFaculty(query.facultyId);
  }

  @Post('seed')
  @ApiOperation({ summary: 'Seed departments data (dev only)' })
  @ApiResponse({ status: 201, description: 'Departments seeded' })
  async seed() {
    await this.departmentsService.seedDepartments();
    return { message: 'Departments seeded successfully' };
  }
}
