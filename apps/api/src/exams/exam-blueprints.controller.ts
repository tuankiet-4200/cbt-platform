import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import {
  CreateExamBlueprintDto,
  UpdateExamBlueprintTemplateDto,
} from './dto/exam-generation.dto';
import { ExamsService } from './exams.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/exam-blueprints')
export class ExamBlueprintsController {
  constructor(private readonly examsService: ExamsService) {}

  @Get()
  listBlueprints(): Promise<unknown> {
    return this.examsService.listExamBlueprints();
  }

  @Post()
  createBlueprint(@Body() dto: CreateExamBlueprintDto, @CurrentUser() user: User): Promise<unknown> {
    return this.examsService.createExamBlueprint(dto, user.id);
  }

  @Patch(':id')
  updateBlueprint(@Param('id') id: string, @Body() dto: UpdateExamBlueprintTemplateDto): Promise<unknown> {
    return this.examsService.updateExamBlueprintTemplate(id, dto);
  }

  @Get(':id/availability')
  checkAvailability(@Param('id') id: string): Promise<unknown> {
    return this.examsService.checkExamBlueprintTemplateAvailability(id);
  }
}
