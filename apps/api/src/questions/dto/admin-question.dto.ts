import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
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

export class BulkUpdateQuestionStatusDto extends UpdateQuestionStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids!: string[];
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
  @Transform(({ value, obj }) => {
    const raw = value ?? obj['tagId[]'] ?? obj.tagIds;
    if (raw === undefined) return undefined;
    return Array.isArray(raw) ? raw : [raw];
  })
  @IsArray()
  @IsString({ each: true })
  tagId?: string[];

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  standaloneOnly?: boolean;
}

export class BulkCreateQuestionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions!: CreateQuestionDto[];
}

export class CreateTagDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  orderIndex?: number;
}
