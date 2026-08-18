import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsUUID, IsOptional } from 'class-validator';
import { GiftTargetType } from '../entities/gift-transaction.entity';

export class SendGiftDto {
  @ApiProperty()
  @IsUUID()
  giftId: string;

  @ApiProperty({ enum: GiftTargetType })
  @IsEnum(GiftTargetType)
  targetType: GiftTargetType;

  @ApiProperty()
  @IsUUID()
  targetId: string;

  @ApiPropertyOptional({ description: 'User ID of the gift recipient. Required for GROUP and DM target types.' })
  @IsOptional()
  @IsUUID()
  recipientId?: string;
}
