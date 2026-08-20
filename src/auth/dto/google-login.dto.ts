import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleLoginDto {
  @ApiProperty({ description: 'Google ID token obtained from the client' })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
