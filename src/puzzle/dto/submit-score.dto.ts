import { IsInt, Min } from 'class-validator';

export class SubmitScoreDto {
  @IsInt()
  @Min(0)
  score: number;

  @IsInt()
  @Min(2)
  highestTile: number;
}
