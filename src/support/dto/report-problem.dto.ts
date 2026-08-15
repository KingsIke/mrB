import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReportProblemDto {
  @ApiProperty({ description: 'Problem category', example: 'Bug' })
  @IsString()
  @IsNotEmpty({ message: 'Category is required' })
  @MaxLength(50)
  category: string;

  @ApiPropertyOptional({ description: 'Short subject line', example: 'App crashes on login' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subject?: string;

  @ApiProperty({ description: 'Detailed description of the problem', example: 'The app crashes every time I try to open the chat tab.' })
  @IsString()
  @IsNotEmpty({ message: 'Please describe the problem you are experiencing' })
  @MaxLength(2000, { message: 'Description must be at most 2000 characters' })
  message: string;
}
