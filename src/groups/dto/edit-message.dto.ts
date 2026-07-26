import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class EditMessageDto {
  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @MaxLength(4000)
  content: string;
}
