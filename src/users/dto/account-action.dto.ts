import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AccountActionDto {
  @ApiProperty({ description: 'Current password to confirm the action', example: 'CurrentPass123!' })
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  @MaxLength(100)
  currentPassword: string;
}
