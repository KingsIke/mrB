import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobType } from '../../jobs/entities/job.entity';

export class CreateJobDto {
  @ApiProperty({ example: 'Frontend Developer Intern' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Looking for a motivated frontend intern...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'TechCorp Nigeria' })
  @IsString()
  company: string;

  @ApiPropertyOptional({ example: 'https://logo.techcorp.com/logo.png' })
  @IsOptional()
  @IsString()
  companyLogo?: string;

  @ApiPropertyOptional({ example: 'Lagos, Nigeria' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ enum: JobType, default: JobType.FULL_TIME })
  @IsOptional()
  @IsEnum(JobType)
  type?: JobType;

  @ApiPropertyOptional({ example: '₦150,000 - ₦250,000' })
  @IsOptional()
  @IsString()
  salary?: string;

  @ApiPropertyOptional({ example: ['React', 'TypeScript', 'REST APIs'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requirements?: string[];

  @ApiPropertyOptional({ example: ['Health insurance', 'Remote work'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[];

  @ApiPropertyOptional({ example: 'hr@techcorp.com' })
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'School ID to scope the job posting' })
  @IsOptional()
  @IsString()
  schoolId?: string;

  @ApiPropertyOptional({ example: true, description: 'Feature this job on the jobs feed' })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}
