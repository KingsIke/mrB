import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PostCategory, PostStatus, PostVisibility, CommentPermission } from '../entities/post.entity';

export class CreatePostDto {
  @ApiPropertyOptional({ description: 'Post text, hashtags auto-detected', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: PostCategory, default: PostCategory.GENERAL })
  @IsOptional()
  @IsEnum(PostCategory)
  category?: PostCategory;

  @ApiPropertyOptional({ example: 'feeling relaxed 😊' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  feeling?: string;

  @ApiPropertyOptional({ example: 'Campus Library' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional({ enum: PostVisibility, default: PostVisibility.PUBLIC })
  @IsOptional()
  @IsEnum(PostVisibility)
  visibility?: PostVisibility;

  @ApiPropertyOptional({ enum: CommentPermission, default: CommentPermission.EVERYONE })
  @IsOptional()
  @IsEnum(CommentPermission)
  commentPermission?: CommentPermission;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  giftsEnabled?: boolean;

  @ApiPropertyOptional({ enum: PostStatus, default: PostStatus.PUBLISHED })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @ApiPropertyOptional({ type: [String], description: 'User IDs tagged in this post' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  taggedUserIds?: string[];

  @ApiPropertyOptional({ type: [String], description: '#Unilag' })
  @IsOptional()
  @IsArray() 
  @IsString({ each: true })
  hashtags?: string[];
}
