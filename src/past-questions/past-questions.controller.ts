import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { PastQuestionsService } from './past-questions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreatePastQuestionDto } from './dto/create-past-question.dto';
import { ListPastQuestionsDto } from './dto/list-past-questions.dto';
import { messageAttachmentUploadOptions } from '../common/multer/message-attachment-upload.config';

@ApiTags('PastQuestions')
@Controller('past-questions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PastQuestionsController {
  constructor(private readonly pqService: PastQuestionsService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files', 10, messageAttachmentUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a past question with files uploaded to Cloudinary' })
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreatePastQuestionDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.pqService.create(userId, dto, files);
  }

  @Get()
  @ApiOperation({ summary: 'List past questions (paginated, with optional filters)' })
  async list(@Query() dto: ListPastQuestionsDto) {
    return this.pqService.list(dto);
  }

  @Get('top-contributors')
  @ApiOperation({ summary: 'Top contributors who uploaded the most past questions in my department' })
  async topContributors(@CurrentUser('userId') userId: string) {
    return this.pqService.topContributors(userId);
  }

  @Get('department')
  @ApiOperation({ summary: 'List past questions uploaded by users in my department' })
  async listDepartment(@CurrentUser('userId') userId: string, @Query() dto: ListPastQuestionsDto) {
    return this.pqService.listByDepartment(userId, dto);
  }

  @Get(':id')
  async find(@Param('id') id: string) {
    return this.pqService.findById(id);
  }

  @Post(':id/download')
  @ApiOperation({ summary: 'Purchase a past question and get its file metadata' })
  async download(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.pqService.purchaseAndGetFiles(id, userId);
  }

  @Get(':id/download')
  @ApiOperation({
    summary: 'Download a past question file (redirects to the file, increments downloadsCount)',
  })
  async downloadFile(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { url } = await this.pqService.getDownloadUrl(id, userId);
    return res.redirect(302, url);
  }
}
