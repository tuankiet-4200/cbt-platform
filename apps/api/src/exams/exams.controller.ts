import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import {
  CheckBlueprintAvailabilityDto,
  CreateExamDto,
  GenerateExamDto,
  PublishExamDto,
  UpdateExamBlueprintDto,
  UpdateExamSettingsDto,
} from './dto/exam-generation.dto';
import { ExamsService } from './exams.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Get()
  listExams(): Promise<unknown> {
    return this.examsService.listExams();
  }

  @Post()
  createExam(@Body() dto: CreateExamDto): Promise<unknown> {
    return this.examsService.createExam(dto);
  }

  @Patch(':id')
  updateSettings(@Param('id') id: string, @Body() dto: UpdateExamSettingsDto): Promise<unknown> {
    return this.examsService.updateSettings(id, dto);
  }

  @Patch(':id/blueprint')
  updateBlueprint(@Param('id') id: string, @Body() dto: UpdateExamBlueprintDto): Promise<unknown> {
    return this.examsService.updateBlueprint(id, dto.blueprintJson);
  }

  @Post('blueprint/availability')
  checkBlueprintAvailability(@Body() dto: CheckBlueprintAvailabilityDto): Promise<unknown> {
    return this.examsService.checkBlueprintAvailability(dto.blueprintJson);
  }

  @Get(':id/availability')
  checkExamAvailability(@Param('id') id: string): Promise<unknown> {
    return this.examsService.checkExamAvailability(id);
  }

  @Post(':id/generate')
  generateDraft(@Param('id') id: string, @Body() dto: GenerateExamDto): Promise<unknown> {
    return this.examsService.generateDraft(id, dto);
  }

  @Post(':id/regenerate')
  regenerateDraft(@Param('id') id: string, @Body() dto: GenerateExamDto): Promise<unknown> {
    return this.examsService.generateDraft(id, {
      ...dto,
      seed: dto.seed ?? `${Date.now()}`,
    });
  }

  @Get(':id/preview')
  preview(@Param('id') id: string): Promise<unknown> {
    return this.examsService.previewExam(id);
  }

  @Patch(':id/publish')
  publish(@Param('id') id: string, @Body() dto: PublishExamDto): Promise<unknown> {
    return this.examsService.setPublishState(id, dto.isPublished);
  }
}
