import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DepartmentQueryDto {
  @ApiProperty({ description: 'Faculty ID (UUID)', example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  facultyId: string;
}
