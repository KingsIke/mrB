import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class AddReactionDto {
  @ApiProperty({ example: '👍', maxLength: 8 })
  @IsString()
  @MaxLength(8)
  emoji: string;
}
