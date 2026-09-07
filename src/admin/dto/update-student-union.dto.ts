import { IsIn, IsOptional } from 'class-validator';
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
}
