import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MaterialsService } from './materials.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MaterialCategory } from './entities/campus-material.entity';
import { CreateMaterialDto } from './dto/create-material.dto';

@ApiTags('Materials')
@Controller('materials')
export class MaterialsController {
  constructor(private readonly service: MaterialsService) {}

  // ── User endpoints ──────────────────────────────────────────────

  @Get(':category')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List materials by category, filtered by user department' })
  async listByCategory(
    @CurrentUser('userId') userId: string,
    @Param('category') category: MaterialCategory,
  ) {
    return this.service.listByCategory(userId, category);
  }

  // ── Admin endpoints ─────────────────────────────────────────────

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all materials (admin)' })
  async adminList(@Query('category') category?: MaterialCategory) {
    return this.service.adminList(category);
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get material by ID (admin)' })
  async adminGetById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.adminGetById(id);
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create material (admin)' })
  async adminCreate(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateMaterialDto,
  ) {
    return this.service.adminCreate(dto, userId);
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update material (admin)' })
  async adminUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateMaterialDto>,
  ) {
    return this.service.adminUpdate(id, dto);
  }

  @Patch('admin/:id/toggle')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle material active status (admin)' })
  async adminToggle(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.adminToggleActive(id);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete material (admin)' })
  async adminDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.adminDelete(id);
  }

  @Delete('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk delete materials (admin)' })
  async adminBulkDelete(@Body() body: { ids: string[] }) {
    return this.service.adminDeleteMany(body.ids);
  }

  @Post('seed')
  @ApiOperation({ summary: 'Seed demo materials for Covenant University Animal Science' })
  async seed() {
    return this.service.seedDemoMaterials();
  }
}
