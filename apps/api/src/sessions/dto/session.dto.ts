import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsIn,
  IsISO8601,
  Min,
  ValidateNested,
  ArrayUnique,
  IsEnum,
} from 'class-validator';
import { ExamSectionType } from '@prisma/client';

export class CreateExamAttemptDto {
  @IsString()
  @IsNotEmpty()
  examId: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsEnum(ExamSectionType, { each: true })
  sectionTypes?: ExamSectionType[];
}

export class SyncAnswerItemDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsObject()
  answerJson: Record<string, unknown>;

  @IsInt()
  @Min(0)
  timeSpentMs: number;
}

export class SyncAnswersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SyncAnswerItemDto)
  answers: SyncAnswerItemDto[];

  @IsInt()
  @Min(0)
  currentIndex: number;
}

export const PROCTORING_EVENT_TYPES = [
  'TAB_SWITCH',
  'FULLSCREEN_EXIT',
  'COPY_ATTEMPT',
  'SESSION_BLUR',
] as const;

export class ProctoringEventDto {
  @IsIn(PROCTORING_EVENT_TYPES)
  eventType: (typeof PROCTORING_EVENT_TYPES)[number];

  @IsISO8601()
  occurredAt: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class RecordProctoringEventsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ProctoringEventDto)
  events: ProctoringEventDto[];
}
