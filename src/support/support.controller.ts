import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SupportService } from './support.service';
import { ReportProblemDto } from './dto/report-problem.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Support')
@Controller('support')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('report-problem')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a problem report to support' })
  @ApiResponse({ status: 201, description: 'Problem report received' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async reportProblem(
    @CurrentUser('userId') userId: string,
    @Body() dto: ReportProblemDto,
  ) {
    const request = await this.supportService.reportProblem(userId, dto);
    return {
      id: request.id,
      status: request.status,
      message: 'Your report has been submitted. Our support team will review it shortly.',
    };
  }
}
