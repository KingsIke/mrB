import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TreasureHuntService } from './treasure-hunt.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Treasure Hunt')
@Controller('treasure-hunt')
export class TreasureHuntController {
  constructor(private readonly service: TreasureHuntService) {}

  // ── User endpoints ──────────────────────────────────────────────

  @Get('available')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if a treasure is available on a screen' })
  async checkAvailable(
    @CurrentUser('userId') userId: string,
    @Query('route') route: string,
  ) {
    if (!route) return { treasure: null };
    const treasure = await this.service.checkAvailable(userId, route);
    return { treasure };
  }

  @Post('claim/:huntId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Claim a treasure hunt reward' })
  async claim(
    @CurrentUser('userId') userId: string,
    @Param('huntId', ParseUUIDPipe) huntId: string,
  ) {
    return this.service.claim(userId, huntId);
  }

  // ── Admin endpoints ─────────────────────────────────────────────

  @Get('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all treasure hunts (admin)' })
  async adminList() {
    return this.service.getAll();
  }

  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Treasure hunt stats (admin)' })
  async adminStats() {
    return this.service.getStats();
  }

  @Get('admin/:id/claims')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List claims for a treasure hunt (admin)' })
  async adminClaims(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getClaims(id);
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a treasure hunt (admin)' })
  async adminCreate(@Body() body: any) {
    return this.service.create(body);
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a treasure hunt (admin)' })
  async adminUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: any,
  ) {
    return this.service.update(id, body);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a treasure hunt (admin)' })
  async adminDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.delete(id);
  }

  @Delete('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk delete treasure hunts (admin)' })
  async adminBulkDelete(@Body() body: { ids: string[] }) {
    return this.service.deleteMany(body.ids);
  }
}
