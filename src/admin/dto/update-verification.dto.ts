import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateVerificationDto {
  @ApiProperty({
    enum: ['verified', 'rejected', 'pending'],
    description: 'New verification status',
  })
  @IsIn(['verified', 'rejected', 'pending'])
  status: 'verified' | 'rejected' | 'pending';

  @ApiPropertyOptional({
    description:
      'Why the documents were rejected. Shown in the student\'s decision email; only used when status is "rejected".',
    example: 'The ID card photo was too blurry to read.',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
