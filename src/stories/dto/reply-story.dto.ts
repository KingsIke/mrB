import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class ReplyStoryDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MaxLength(500)
  text: string;
}
