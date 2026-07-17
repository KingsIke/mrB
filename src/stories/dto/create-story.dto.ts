import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateStoryDto {
  @ApiPropertyOptional({ description: 'Text content for a text-only story', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  textContent?: string;
}
