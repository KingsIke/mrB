import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsIn } from 'class-validator';

export class CreateStoryDto {
  @ApiPropertyOptional({ description: 'Text content for a text-only story', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  textContent?: string;

  @ApiPropertyOptional({ description: 'Hex background color for text stories' })
  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @ApiPropertyOptional({ description: 'Text alignment adjustment', enum: ['left', 'center', 'right'] })
  @IsOptional()
  @IsIn(['left', 'center', 'right'])
  textAlign?: 'left' | 'center' | 'right';
}