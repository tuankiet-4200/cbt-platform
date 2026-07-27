import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ExamSectionType } from '@prisma/client';

export class ResultReviewQueryDto {
  @IsOptional()
  @IsEnum(ExamSectionType)
  section: ExamSectionType = ExamSectionType.MATH;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  limit = 10;
}
