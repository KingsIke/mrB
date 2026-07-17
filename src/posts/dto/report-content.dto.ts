import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class ReportContentDto {
  @ApiProperty({ maxLength: 500, example: 'Spam / misleading content' })
  @IsString()
  @MaxLength(500)
  reason: string;
}
