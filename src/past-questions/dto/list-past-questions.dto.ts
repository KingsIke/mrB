import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListPastQuestionsDto {
  // Add page and limit explicitly
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Number of items per page', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Filter by level (e.g. 100, 200, 300)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  level?: string;

  @ApiPropertyOptional({ description: 'Filter by course code/name (partial match)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  course?: string;


  
  // @ApiPropertyOptional({ description: 'Filter by course code/name (partial match)' })
  // @IsOptional()
  // @IsString()
  // @MaxLength(255)
  // courseCode?: string;

  @ApiPropertyOptional({ description: 'Filter by academic session (e.g. 2023/2024)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  session?: string;

  @ApiPropertyOptional({ description: 'Filter by semester (e.g. first, second)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  semester?: string;
}