import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
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
}
