import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SupportRequestStatus } from '../../support/entities/support-request.entity';

export class UpdateSupportRequestStatusDto {
  @ApiProperty({ enum: SupportRequestStatus, description: 'New support request status' })
  @IsIn(Object.values(SupportRequestStatus))
  status: SupportRequestStatus;
}
