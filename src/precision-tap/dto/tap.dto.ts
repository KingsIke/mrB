import { IsUUID } from 'class-validator';

export class TapDto {
  @IsUUID()
  roundId: string;
}
