import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Verify2faDto {
  @ApiProperty({ description: 'User email', example: 'student@university.edu.ng' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: '6-digit code emailed for two-factor authentication', example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;
}
