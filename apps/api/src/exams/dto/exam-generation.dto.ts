import {
  IsArray,
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
import { ExamAccessType, ExamBlueprintStatus, ExamSectionType } from '@prisma/client';

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

  @IsOptional()
  @IsString()
  blueprintId?: string;
}

export class CreateExamBlueprintDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  durationMins?: number;

  @IsOptional()
  @IsEnum(ExamBlueprintStatus)
  status?: ExamBlueprintStatus;

  @IsObject()
  blueprintJson!: Record<string, unknown>;
}

export class UpdateExamBlueprintTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  durationMins?: number;

  @IsOptional()
  @IsEnum(ExamBlueprintStatus)
  status?: ExamBlueprintStatus;

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

export class ReorderMathQuestionsDto {
  @IsArray()
  @IsString({ each: true })
  questionIds!: string[];
}

export class ReorderPassageBundlesDto {
  @IsEnum(ExamSectionType)
  sectionType!: ExamSectionType;

  @IsArray()
  @IsString({ each: true })
  passageBundleIds!: string[];
}

export class ReplaceMathQuestionDto {
  @IsString()
  currentQuestionId!: string;

  @IsString()
  replacementQuestionId!: string;
}

export class ReplacePassageBundleDto {
  @IsEnum(ExamSectionType)
  sectionType!: ExamSectionType;

  @IsString()
  currentPassageBundleId!: string;

  @IsString()
  replacementPassageBundleId!: string;
}
