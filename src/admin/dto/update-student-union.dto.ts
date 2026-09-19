import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStudentUnionDto {
  @ApiProperty({
    enum: ['verified', 'rejected', 'pending'],
    description: 'New Student Union verification status',
  })
  @IsIn(['verified', 'rejected', 'pending'])
  status: 'verified' | 'rejected' | 'pending';

  @ApiPropertyOptional({
    description: 'Also grant/revoke the studentUnion flag',
  })
  @IsOptional()
  @IsIn([true, false])
  grantAccess?: boolean;

  @ApiPropertyOptional({
    description:
      'Why the document was rejected. Shown in the student\'s decision email; only used when status is "rejected".',
    example: 'Please upload the stamped union membership letter.',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
