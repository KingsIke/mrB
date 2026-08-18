import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateGiftDto {
  @ApiPropertyOptional({ example: 'Golden Crown' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  coinCost?: number;

  @ApiPropertyOptional({ example: 10, description: 'Discount percentage (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'https://assets.app.com/gifts/animation/sparkle.json' })
  @IsOptional()
  @IsString()
  animationUrl?: string;

  @ApiPropertyOptional({ example: 'https://assets.app.com/gifts/videos/rare/golden-crown.mp4' })
  @IsOptional()
  @IsString()
  videoUrl?: string;
}
