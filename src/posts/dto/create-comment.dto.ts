import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  text: string;

  @ApiPropertyOptional({ description: 'Set when replying to another comment' })
  @IsOptional()
  @IsUUID()
  parentCommentId?: string;
}
