import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FacultyQueryDto {
  @ApiProperty({ description: 'School ID (UUID)', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  schoolId: string;
}
