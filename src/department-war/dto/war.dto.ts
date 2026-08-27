import { IsString, IsOptional, IsInt, IsEnum, IsDateString, Min, Max } from 'class-validator';
import { BattleType } from '../entities';

export class ChallengeDto {
  @IsString()
  opponentId: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(20)
  totalQuestions?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(30)
  timePerQuestion?: number;
}

export class AcceptChallengeDto {
  @IsString()
  battleId: string;
}

export class ScheduleBattleDto {
  @IsString()
  opponentId: string;

  @IsDateString()
  scheduledAt: string; // ISO date string

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(20)
  totalQuestions?: number;
}

export class SubmitAnswerDto {
  @IsString()
  battleId: string;

  @IsInt()
  @Min(0)
  @Max(3)
  selectedOption: number;

  @IsInt()
  @Min(0)
  timeTakenMs: number;

  @IsInt()
  questionIndex: number;
}

export class SearchOpponentDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;
}

export class MatchmakingDto {
  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsInt()
  level?: number;

  // When set, sends the quick-match request directly to this user
  // (picked from the active-users list) instead of auto-selecting an opponent.
  @IsOptional()
  @IsString()
  opponentId?: string;
}

export class GetWarHistoryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}

export class SeedQuestionsDto {
  @IsString()
  questionText: string;

  @IsInt()
  @Min(0)
  @Max(3)
  correctIndex: number;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  difficulty?: string;
}
