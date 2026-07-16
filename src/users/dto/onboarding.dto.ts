import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsDateString,
  IsEnum,
  MinLength,
  MaxLength,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserGender } from '../entities/user.entity';

export class OnboardingStep1Dto {
  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ description: 'Date of birth', example: '2000-05-15' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ description: 'Gender', enum: UserGender, example: 'male' })
  @IsEnum(UserGender)
  gender: UserGender;
}

export class OnboardingStep2Dto {
  @ApiProperty({ description: 'School ID (UUID)', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  schoolId: string;

  @ApiProperty({ description: 'Faculty ID (UUID)', example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  facultyId: string;

  @ApiProperty({ description: 'Department ID (UUID)', example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsUUID()
  departmentId: string;

  @ApiPropertyOptional({ description: 'Matric number (if available)', example: 'ENG/2020/001' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  matricNumber?: string;

  @ApiPropertyOptional({ description: 'JAMB number (if available)', example: '12345678AB' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  jambNumber?: string;
}

export class OnboardingStep3Dto {
  @ApiProperty({ description: 'Unique username', example: 'johndoe2024' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username: string;

  @ApiProperty({ description: 'Phone number', example: '+2348012345678' })
  @IsString()
  @MaxLength(255)
  phoneNumber: string;

  @ApiProperty({ description: 'Accept terms and conditions', example: true })
  @IsBoolean()
  termsAccepted: boolean;
}

export class CompleteOnboardingDto {
  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ description: 'Date of birth', example: '2000-05-15' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ description: 'Gender', enum: UserGender, example: 'male' })
  @IsEnum(UserGender)
  gender: UserGender;

  @ApiProperty({ description: 'School ID (UUID)', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  schoolId: string;

  @ApiProperty({ description: 'Faculty ID (UUID)', example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  facultyId: string;

  @ApiProperty({ description: 'Department ID (UUID)', example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsUUID()
  departmentId: string;

  @ApiPropertyOptional({ description: 'Matric number', example: 'ENG/2020/001' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  matricNumber?: string;

  @ApiPropertyOptional({ description: 'JAMB number', example: '12345678AB' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  jambNumber?: string;

  @ApiProperty({ description: 'Unique username', example: 'johndoe2024' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username: string;

  @ApiProperty({ description: 'Phone number', example: '+2348012345678' })
  @IsString()
  @MaxLength(255)
  phoneNumber: string;

  @ApiProperty({ description: 'Accept terms and conditions', example: true })
  @IsBoolean()
  termsAccepted: boolean;
}



export interface ForgotPasswordDto {
  email: string;
}

export interface VerifyResetOtpDto {
  email: string;
  code: string;
}

export class ResetPasswordWithTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'The reset token is required' })
  resetToken: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}