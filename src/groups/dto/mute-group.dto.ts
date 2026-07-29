import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class MuteGroupDto {
  @ApiProperty({ description: 'Mute or unmute notifications for this group' })
  @IsBoolean()
  isMuted: boolean;
}
