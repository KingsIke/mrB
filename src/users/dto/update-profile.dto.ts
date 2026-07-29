import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  MinLength,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserGender } from '../entities/user.entity';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'First name', example: 'John' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name', example: 'Doe' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

   @ApiPropertyOptional({ description: 'Profile picture' })
  @IsOptional()
  @IsString()
  profilePictureUrl?: string;

     @ApiPropertyOptional({ description: 'user bio' })
  @IsOptional()
  @IsString()
  bio?: string;
  @ApiPropertyOptional({ description: 'Username', example: 'johndoe2024' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+2348012345678' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'Gender', enum: UserGender })
  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @ApiPropertyOptional({ description: 'Date of birth', example: '2000-05-15' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'School ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional({ description: 'Faculty ID', example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsUUID()
  facultyId?: string;

  @ApiPropertyOptional({ description: 'Department ID', example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

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


  @IsOptional()
  @IsString()
  bubbleColor?: string;

  @IsOptional()
  @IsString()
  bubbleStyle?: string;
}
