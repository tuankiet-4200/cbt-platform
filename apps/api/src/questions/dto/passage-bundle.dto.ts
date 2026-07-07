import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OmitType } from '@nestjs/swagger';
import { ExamSectionType, QuestionStatus } from '@prisma/client';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { CreateQuestionDto } from './admin-question.dto';

export class BundleQuestionLinkDto {
  @IsString()
  questionId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  orderInBundle!: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  points?: number;
}

export class CreatePassageBundleDto {
  @IsEnum(ExamSectionType)
  sectionType!: ExamSectionType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsArray()
  contentJson!: unknown[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(7200)
  expectedTimeSecs?: number;

  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BundleQuestionLinkDto)
  questions!: BundleQuestionLinkDto[];
}

export class BundleQuestionCreateDto extends CreateQuestionDto {
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  points?: number;
}

export class CreatePassageBundleWithQuestionsDto extends OmitType(CreatePassageBundleDto, ['questions'] as const) {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BundleQuestionCreateDto)
  questions!: BundleQuestionCreateDto[];
}

export class UpdatePassageBundleDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsArray()
  contentJson?: unknown[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(7200)
  expectedTimeSecs?: number;

  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BundleQuestionLinkDto)
  questions?: BundleQuestionLinkDto[];
}

export class ListPassageBundlesDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ExamSectionType)
  sectionType?: ExamSectionType;

  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;
}
