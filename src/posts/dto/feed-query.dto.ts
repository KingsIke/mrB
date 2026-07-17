import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CursorPaginationDto } from '../../common/pagination/cursor-pagination.dto';

export enum FeedTab {
  FOR_YOU = 'for-you',
  FOLLOWING = 'following',
  CAMPUS = 'campus',
}

export class FeedQueryDto extends CursorPaginationDto {
  @ApiPropertyOptional({ enum: FeedTab, default: FeedTab.FOR_YOU })
  @IsOptional()
  @IsEnum(FeedTab)
  tab?: FeedTab = FeedTab.FOR_YOU;
}
