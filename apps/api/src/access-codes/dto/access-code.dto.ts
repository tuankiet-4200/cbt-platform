import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAccessCodeDto {
  @IsString()
  examId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  maxUses?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UnlockExamDto {
  @IsString()
  code!: string;
}
