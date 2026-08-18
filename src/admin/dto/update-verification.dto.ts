import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateVerificationDto {
  @ApiProperty({
    enum: ['verified', 'rejected', 'pending'],
    description: 'New verification status',
  })
  @IsIn(['verified', 'rejected', 'pending'])
  status: 'verified' | 'rejected' | 'pending';
}
