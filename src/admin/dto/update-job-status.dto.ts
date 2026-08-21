import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JobStatus } from '../../jobs/entities/job.entity';

export class UpdateJobStatusDto {
  @ApiProperty({ enum: JobStatus, description: 'New job status' })
  @IsIn(Object.values(JobStatus))
  status: JobStatus;
}
