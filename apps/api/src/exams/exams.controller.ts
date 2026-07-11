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
  ReorderMathQuestionsDto,
  ReorderPassageBundlesDto,
  ReplaceMathQuestionDto,
  ReplacePassageBundleDto,
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

  @Get(':id/builder')
  builder(@Param('id') id: string): Promise<unknown> {
    return this.examsService.getExamBuilder(id);
  }

  @Get(':id/builder/candidates')
  replacementCandidates(@Param('id') id: string): Promise<unknown> {
    return this.examsService.listReplacementCandidates(id);
  }

  @Patch(':id/builder/math/reorder')
  reorderMath(@Param('id') id: string, @Body() dto: ReorderMathQuestionsDto): Promise<unknown> {
    return this.examsService.reorderMathQuestions(id, dto.questionIds);
  }

  @Patch(':id/builder/bundles/reorder')
  reorderBundles(@Param('id') id: string, @Body() dto: ReorderPassageBundlesDto): Promise<unknown> {
    return this.examsService.reorderPassageBundles(id, dto.sectionType, dto.passageBundleIds);
  }

  @Patch(':id/builder/math/replace')
  replaceMath(@Param('id') id: string, @Body() dto: ReplaceMathQuestionDto): Promise<unknown> {
    return this.examsService.replaceMathQuestion(id, dto.currentQuestionId, dto.replacementQuestionId);
  }

  @Patch(':id/builder/bundles/replace')
  replaceBundle(@Param('id') id: string, @Body() dto: ReplacePassageBundleDto): Promise<unknown> {
    return this.examsService.replacePassageBundle(
      id,
      dto.sectionType,
      dto.currentPassageBundleId,
      dto.replacementPassageBundleId,
    );
  }

  @Patch(':id/publish')
  publish(@Param('id') id: string, @Body() dto: PublishExamDto): Promise<unknown> {
    return this.examsService.setPublishState(id, dto.isPublished);
  }
}
