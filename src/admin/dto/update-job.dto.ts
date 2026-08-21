import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { JobType } from '../../jobs/entities/job.entity';

export class UpdateJobDto {
  @ApiPropertyOptional({ example: 'Senior Frontend Developer' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description for the role...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'TechCorp Nigeria' })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({ example: 'https://logo.techcorp.com/logo.png' })
  @IsOptional()
  @IsString()
  companyLogo?: string;

  @ApiPropertyOptional({ example: 'Abuja, Nigeria' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ enum: JobType })
  @IsOptional()
  @IsEnum(JobType)
  type?: JobType;

  @ApiPropertyOptional({ example: '₦200,000 - ₦350,000' })
  @IsOptional()
  @IsString()
  salary?: string;

  @ApiPropertyOptional({ example: ['React', 'Next.js', 'TypeScript'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requirements?: string[];

  @ApiPropertyOptional({ example: ['Health insurance', 'Unlimited PTO'] })
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

  @ApiPropertyOptional({ example: true, description: 'Feature this job on the jobs feed' })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}
