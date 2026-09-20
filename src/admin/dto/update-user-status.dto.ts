import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserStatusDto {
  @ApiProperty({ enum: ['active', 'restricted', 'suspended', 'banned'], description: 'New account status' })
  @IsIn(['active', 'restricted', 'suspended', 'banned'])
  status: 'active' | 'restricted' | 'suspended' | 'banned';

  @ApiPropertyOptional({ description: 'Reason shown to the user, required for restricted/suspended/banned' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
