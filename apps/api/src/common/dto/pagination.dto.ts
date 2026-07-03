import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export function paginate<T>(
  data: T[],
  total: number,
  dto: PaginationDto,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / dto.limit);
  return {
    data,
    meta: {
      total,
      page: dto.page,
      limit: dto.limit,
      totalPages,
      hasNextPage: dto.page < totalPages,
      hasPrevPage: dto.page > 1,
    },
  };
}
