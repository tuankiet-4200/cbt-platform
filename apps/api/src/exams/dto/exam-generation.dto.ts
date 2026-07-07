import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExamAccessType } from '@prisma/client';

export class CreateExamDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  durationMins?: number;

  @IsOptional()
  @IsEnum(ExamAccessType)
  accessType?: ExamAccessType;

  @IsOptional()
  @IsObject()
  blueprintJson?: Record<string, unknown>;
}

export class UpdateExamBlueprintDto {
  @IsObject()
  blueprintJson!: Record<string, unknown>;
}

export class UpdateExamSettingsDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ExamAccessType)
  accessType?: ExamAccessType;
}

export class CheckBlueprintAvailabilityDto {
  @IsObject()
  blueprintJson!: Record<string, unknown>;
}

export class GenerateExamDto {
  @IsOptional()
  @IsString()
  seed?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  maxAttempts?: number;
}

export class PublishExamDto {
  @IsBoolean()
  isPublished!: boolean;
}
