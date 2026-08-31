import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { CallsService } from './calls.service';
import { CallType, CallStatus } from './entities/call-history.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Calls')
@Controller('calls')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  // --------------------------------------------------------------------------
  // 📞 CALL HISTORY ROUTES
  // --------------------------------------------------------------------------

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a new call' })
  @ApiBody({
    schema: {
      properties: {
        calleeId: { type: 'string', format: 'uuid' },
        callType: { type: 'string', enum: ['video', 'audio'] },
        streamCallId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Call recorded' })
  async createCall(
    @CurrentUser('userId') userId: string,
    @Body() body: { calleeId: string; callType?: CallType; streamCallId?: string },
  ) {
    return this.callsService.createCall({
      callerId: userId,
      calleeId: body.calleeId,
      callType: body.callType || CallType.VIDEO,
      streamCallId: body.streamCallId,
    });
  }

  @Patch(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a call as accepted' })
  @ApiParam({ name: 'id', description: 'Call UUID' })
  @ApiResponse({ status: 200, description: 'Call marked as accepted' })
  async acceptCall(@Param('id', ParseUUIDPipe) id: string) {
    return this.callsService.acceptCall(id);
  }

  @Patch(':id/end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End a call and calculate duration' })
  @ApiParam({ name: 'id', description: 'Call UUID' })
  @ApiResponse({ status: 200, description: 'Call ended' })
  async endCall(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body?: { status?: CallStatus },
  ) {
    return this.callsService.endCall(id, body?.status);
  }

  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a call as rejected' })
  @ApiParam({ name: 'id', description: 'Call UUID' })
  @ApiResponse({ status: 200, description: 'Call marked as rejected' })
  async rejectCall(@Param('id', ParseUUIDPipe) id: string) {
    return this.callsService.rejectCall(id);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a call as cancelled' })
  @ApiParam({ name: 'id', description: 'Call UUID' })
  @ApiResponse({ status: 200, description: 'Call marked as cancelled' })
  async cancelCall(@Param('id', ParseUUIDPipe) id: string) {
    return this.callsService.cancelCall(id);
  }

  // --------------------------------------------------------------------------
  // 📋 HISTORY & QUERIES
  // --------------------------------------------------------------------------

  @Get('history')
  @ApiOperation({ summary: 'Get call history for the current user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated call history' })
  async getMyCallHistory(
    @CurrentUser('userId') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.callsService.getCallHistory(userId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get('missed-count')
  @ApiOperation({ summary: 'Get missed calls count' })
  @ApiResponse({ status: 200, description: 'Missed calls count' })
  async getMissedCallsCount(@CurrentUser('userId') userId: string) {
    const count = await this.callsService.getMissedCallsCount(userId);
    return { count };
  }

  @Patch('missed/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all missed calls as read' })
  @ApiResponse({ status: 200, description: 'Missed calls marked as read' })
  async markMissedCallsRead(@CurrentUser('userId') userId: string) {
    return this.callsService.markMissedCallsRead(userId);
  }

  @Get('history/:userId')
  @ApiOperation({ summary: 'Get call history between current user and another user' })
  @ApiParam({ name: 'userId', description: 'Other user UUID' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Call history between two users' })
  async getCallHistoryBetween(
    @CurrentUser('userId') currentUserId: string,
    @Param('userId', ParseUUIDPipe) otherUserId: string,
    @Query('limit') limit?: number,
  ) {
    return this.callsService.getCallHistoryBetween(
      currentUserId,
      otherUserId,
      limit ? Number(limit) : 20,
    );
  }
}
