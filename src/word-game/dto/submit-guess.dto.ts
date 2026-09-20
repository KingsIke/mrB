import { IsString, Length, Matches } from 'class-validator';

export class SubmitGuessDto {
  @IsString()
  @Length(5, 5)
  @Matches(/^[a-zA-Z]+$/, { message: 'Guess must contain only letters' })
  guess: string;
}
