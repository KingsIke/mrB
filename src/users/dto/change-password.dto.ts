import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password', example: 'CurrentPass123!' })
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  @MinLength(8, { message: 'Current password must be at least 8 characters long' })
  @MaxLength(100)
  currentPassword: string;

  @ApiProperty({ description: 'New password (min 8 chars)', example: 'NewSecurePass123!' })
  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  @MaxLength(100)
  newPassword: string;
}
