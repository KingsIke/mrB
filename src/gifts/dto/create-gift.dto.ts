import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsUrl,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGiftDto {
  @ApiProperty({ example: 'Golden Crown' })
  @IsString()
  name: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(1)
  coinCost: number;

  @ApiProperty({ example: 'rare' })
  @IsString()
  rarity: string;

  @ApiProperty({ example: 'sparkle' })
  @IsString()
  animation: string;

  @ApiProperty({ example: 'https://assets.app.com/gifts/videos/rare/golden-crown.mp4' })
  @IsUrl()
  videoUrl: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 10, description: 'Discount percentage (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  discountExpiresAt?: Date;
}
