import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { MarketplaceStatus } from '../entities/marketplace-item.entity';

export enum PreferredContact {
  CHAT = 'Chat',
  CALL = 'Call',
  WHATSAPP = 'WhatsApp',
}

export class CreateMarketplaceDto {
  @IsString()
  title: string;

  @IsString()
  category: string;

  @IsString()
  condition: string;

  @IsString()
  description: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'yes' || value === 'true';
    return false;
  })
  @IsBoolean()
  isNegotiable: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountPrice?: number;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number = 1;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  whatsApp?: string;

  @IsOptional()
  @IsEnum(PreferredContact)
  preferredContact?: PreferredContact = PreferredContact.CHAT;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [value];
      }
    }
    return value;
  })
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsEnum(MarketplaceStatus)
  status?: MarketplaceStatus;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}