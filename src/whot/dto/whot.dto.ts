import { IsInt, IsIn, IsOptional, IsString, Min, Max, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { COIN_BATTLE_STAKES } from '../../coin-battle/entities/coin-battle.entity';
import { WHOT_TABLE_SIZES } from '../entities/whot-table.entity';
import { WHOT_SHAPES } from '../whot-deck';

// Whot reuses Coin Battle's stake tiers per the confirmed design decision.
export const WHOT_STAKES = COIN_BATTLE_STAKES;

export class JoinTableDto {
  @ApiProperty({ enum: WHOT_STAKES, description: 'Amount of coins to wager' })
  @IsInt()
  @IsIn(WHOT_STAKES as unknown as number[])
  stake: number;

  @ApiProperty({ enum: WHOT_TABLE_SIZES, description: 'Number of seats at the table (2-4)' })
  @IsInt()
  @IsIn(WHOT_TABLE_SIZES as unknown as number[])
  maxPlayers: number;
}

// Kept as a distinct type alongside JoinTableDto to mirror the approved plan's
// entity/DTO shape; createOrJoinTable() serves both "create" and "join" from
// the same queue/join endpoint since v1 is public-queue only.
export class CreateTableDto extends JoinTableDto {}

export class BotStartDto {
  @ApiProperty({ enum: WHOT_STAKES, description: 'Amount of coins to wager against the computer opponent' })
  @IsInt()
  @IsIn(WHOT_STAKES as unknown as number[])
  stake: number;
}

export class PlayCardDto {
  @ApiProperty({ description: 'Table ID' })
  @IsUUID()
  tableId: string;

  @ApiProperty({ description: 'Card code, e.g. "circle-5" or "whot-20"' })
  @IsString()
  card: string;

  @ApiPropertyOptional({ enum: WHOT_SHAPES, description: 'Required when playing a Whot-20 wild card' })
  @IsOptional()
  @IsString()
  @IsIn(WHOT_SHAPES as unknown as string[])
  calledShape?: string;
}

export class DrawCardDto {
  @ApiProperty({ description: 'Table ID' })
  @IsUUID()
  tableId: string;
}

export class WhotHistoryDto {
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;
}
