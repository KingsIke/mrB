import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, MaxLength } from 'class-validator';
import { ReportTargetType } from '../../posts/entities/content-report.entity';

/** Content types reported through POST /reports. Posts, comments, accounts
 * and messages keep their own report endpoints. */
export const GENERIC_REPORT_TYPES = [
  ReportTargetType.STORY,
  ReportTargetType.MARKETPLACE_ITEM,
  ReportTargetType.HOSTEL_LISTING,
  ReportTargetType.PAST_QUESTION,
  ReportTargetType.MATERIAL,
] as const;
export type GenericReportType = (typeof GENERIC_REPORT_TYPES)[number];

export class CreateReportDto {
  @ApiProperty({ enum: GENERIC_REPORT_TYPES })
  @IsIn(GENERIC_REPORT_TYPES)
  targetType: GenericReportType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetId: string;

  @ApiProperty({ maxLength: 500, example: 'Spam or scam' })
  @IsString()
  @MaxLength(500)
  reason: string;
}
