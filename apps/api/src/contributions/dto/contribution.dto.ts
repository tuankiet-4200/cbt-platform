import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ContributionStatus } from '@prisma/client';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class CreateContributionDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class ListContributionsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ContributionStatus)
  status?: ContributionStatus;
}

export class UpdateContributionStatusDto {
  @IsEnum(ContributionStatus)
  status!: ContributionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}

