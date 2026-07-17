import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class PurchaseCoinsDto {
  @ApiProperty({ description: 'Number of Campus Coins to purchase', example: 500, minimum: 1 })
  @IsInt()
  @Min(1)
  coins: number;
}
