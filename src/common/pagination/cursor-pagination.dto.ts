import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CursorPaginationDto {
  @ApiPropertyOptional({ description: 'Opaque cursor returned by the previous page' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Page size', default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export interface CursorPaginated<T> {
  items: T[];
  nextCursor: string | null;
}

/** Encodes a (createdAt, id) keyset cursor as an opaque base64 string. */
export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}_${id}`).toString('base64');
}

export function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  const [createdAt, id] = Buffer.from(cursor, 'base64').toString('utf-8').split('_');
  return { createdAt: new Date(createdAt), id };
}
