import { IsEmail, IsString, Length, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReactivateAccountDto {
  @ApiProperty({ description: 'User email', example: 'student@university.edu.ng' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Password', example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ description: '6-digit OTP sent to the email', example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;
}
