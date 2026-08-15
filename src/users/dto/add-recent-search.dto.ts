// dto/add-recent-search.dto.ts
import { IsNotEmpty, IsUUID } from 'class-validator';

export class AddRecentSearchDto {
  @IsNotEmpty()
  @IsUUID()
  searchedUserId: string;
}