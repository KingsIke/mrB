import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class LockGroupDto {
  @ApiProperty({ description: 'When true, only admins can post (announcement mode)' })
  @IsBoolean()
  isLocked: boolean;
}
