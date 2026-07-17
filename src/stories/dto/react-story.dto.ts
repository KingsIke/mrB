import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ALLOWED_STORY_REACTION_EMOJIS } from '../entities/story-reaction.entity';

export class ReactStoryDto {
  @ApiProperty({ enum: ALLOWED_STORY_REACTION_EMOJIS })
  @IsIn(ALLOWED_STORY_REACTION_EMOJIS)
  emoji: string;
}
