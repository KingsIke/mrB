import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ReportStatus } from '../../posts/entities/content-report.entity';

export class UpdateContentReportStatusDto {
  @ApiProperty({ enum: ReportStatus, description: 'New content report status' })
  @IsIn(Object.values(ReportStatus))
  status: ReportStatus;
}
