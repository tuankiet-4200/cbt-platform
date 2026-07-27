import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateExamAttemptDto {
  @IsString()
  @IsNotEmpty()
  examId: string;
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
