import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class StartRoundDto {
  @IsInt()
  @Min(1)
  stake: number;

  // Purely a difficulty knob (speed scales with this) — client-supplied
  // since lying about it can only make the round easier for the same
  // stake, never more rewarding, so there's nothing to validate server-side
  // beyond a sane range.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  streakCount?: number;
}
