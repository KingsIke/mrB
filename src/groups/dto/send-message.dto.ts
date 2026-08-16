import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class SendMessageDto {
  @ApiPropertyOptional({ maxLength: 4000, description: 'Text content; optional if attachments are provided' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @ApiPropertyOptional({ description: 'ID of the message being replied to' })
  @IsOptional()
  @IsUUID('4')
  replyToId?: string;

  @ApiPropertyOptional({ description: 'Duration of an audio attachment in milliseconds (voice notes)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationMillis?: number;
}
