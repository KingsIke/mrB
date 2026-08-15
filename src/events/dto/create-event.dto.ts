import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsBoolean,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { EventCategory } from '../entities/event.entity';

export class CreateEventDto {
  @ApiProperty({
    description: 'Title of the event',
    example: 'Freshers Welcome Party',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @ApiProperty({
    description: 'Detailed description of the event',
    example: 'Kick off the semester with music, games, food and lots of fun!',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    description: 'URL of the event cover image',
    example: 'https://example.com/images/freshers-party.jpg',
  })
  @IsString()
  @IsOptional()
  coverImage?: string;

  @ApiProperty({
    description: 'Date when the event takes place',
    example: '16 Aug 2026',
  })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({
    description: 'Time when the event starts',
    example: '6:00 PM',
  })
  @IsString()
  @IsNotEmpty()
  time: string;

  @ApiProperty({
    description: 'Physical or virtual location of the event',
    example: 'Student Center, Main Campus',
  })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({
    enum: EventCategory,
    description: 'Category/type of the event',
    example: EventCategory.SOCIAL,
  })
  @IsEnum(EventCategory)
  @IsNotEmpty()
  category: EventCategory;

  @ApiPropertyOptional({
    description: 'Flag indicating whether to feature the event',
    default: false,
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isFeatured?: boolean;
}