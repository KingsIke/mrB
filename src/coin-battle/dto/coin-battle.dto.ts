import { IsInt, IsIn, IsOptional, IsString, Min, Max, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { COIN_BATTLE_STAKES } from '../entities/coin-battle.entity';

export class ChallengeDto {
  @ApiProperty({ description: 'ID of the user being challenged' })
  @IsUUID()
  opponentId: string;

  @ApiProperty({ enum: COIN_BATTLE_STAKES, description: 'Amount of coins to wager' })
  @IsInt()
  @IsIn(COIN_BATTLE_STAKES)
  stake: number;
}

export class JoinQueueDto {
  @ApiProperty({ enum: COIN_BATTLE_STAKES, description: 'Amount of coins to wager' })
  @IsInt()
  @IsIn(COIN_BATTLE_STAKES)
  stake: number;
}

export class SubmitCoinBattleAnswerDto {
  @ApiProperty({ description: 'Battle ID' })
  @IsString()
  battleId: string;

  @ApiProperty({ description: 'Question index (0-based)' })
  @IsInt()
  @Min(0)
  questionIndex: number;

  @ApiProperty({ description: 'Selected option index (0-3) or -1 for timeout' })
  @IsInt()
  @Min(-1)
  @Max(3)
  selectedOption: number;

  @ApiPropertyOptional({ description: 'Time taken in milliseconds' })
  @IsOptional()
  @IsInt()
  @Min(0)
  timeTakenMs?: number;
}

export class CoinBattleHistoryDto {
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
