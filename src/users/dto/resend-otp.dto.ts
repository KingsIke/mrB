import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendOtpDto {
  @ApiProperty({ description: 'User email', example: 'student@university.edu.ng' })
  @IsEmail()
  email: string;
}
