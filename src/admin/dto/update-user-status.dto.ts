import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserStatusDto {
  @ApiProperty({ enum: ['active', 'suspended'], description: 'New account status' })
  @IsIn(['active', 'suspended'])
  status: 'active' | 'suspended';
}
