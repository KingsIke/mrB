import { IsNotEmpty, IsString, IsOptional, IsArray, MaxLength } from 'class-validator';

export class CreateProjectTopicDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  course?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  courseCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  level?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
