import {
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CognitiveLevel, QuestionStatus, QuestionType } from '@prisma/client';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class CreateQuestionDto {
  @IsEnum(QuestionType)
  type!: QuestionType;

  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;

  @IsOptional()
  @IsEnum(CognitiveLevel)
  level?: CognitiveLevel;

  @IsObject()
  contentJson!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  irtParams?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(3600)
  expectedTimeSecs?: number;

  @IsOptional()
  @IsString()
  authorId?: string;

  @IsOptional()
  @IsString()
  contributionId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];
}

export class UpdateQuestionDto {
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @IsOptional()
  @IsEnum(CognitiveLevel)
  level?: CognitiveLevel;

  @IsOptional()
  @IsObject()
  contentJson?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  irtParams?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(3600)
  expectedTimeSecs?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];

  @IsOptional()
  @IsString()
  reviewNote?: string;
}

export class UpdateQuestionStatusDto {
  @IsEnum(QuestionStatus)
  status!: QuestionStatus;

  @IsOptional()
  @IsString()
  reviewNote?: string;
}

export class ListQuestionsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @IsOptional()
  @IsEnum(CognitiveLevel)
  level?: CognitiveLevel;

  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;

  @IsOptional()
  @IsString()
  tagId?: string;
}

