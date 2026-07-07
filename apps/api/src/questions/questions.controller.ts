import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { QuestionsService } from './questions.service';
import {
  BulkCreateQuestionsDto,
  BulkUpdateQuestionStatusDto,
  CreateTagDto,
  CreateQuestionDto,
  ListTagsDto,
  ListQuestionsDto,
  UpdateTagDto,
  UpdateQuestionDto,
  UpdateQuestionStatusDto,
} from './dto/admin-question.dto';
import {
  CreatePassageBundleDto,
  CreatePassageBundleWithQuestionsDto,
  ListPassageBundlesDto,
  UpdatePassageBundleDto,
} from './dto/passage-bundle.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get('tags')
  listTags(@Query() dto: ListTagsDto) {
    return this.questionsService.listTags(dto);
  }

  @Post('tags')
  createTag(@Body() dto: CreateTagDto) {
    return this.questionsService.createTag(dto);
  }

  @Get('tags/:id')
  getTag(@Param('id') id: string) {
    return this.questionsService.getTag(id);
  }

  @Patch('tags/:id')
  updateTag(@Param('id') id: string, @Body() dto: UpdateTagDto) {
    return this.questionsService.updateTag(id, dto);
  }

  @Post('questions')
  createQuestion(@Body() dto: CreateQuestionDto, @CurrentUser() user: User) {
    return this.questionsService.createQuestion(dto, user);
  }

  @Post('questions/bulk')
  bulkCreateQuestions(@Body() dto: BulkCreateQuestionsDto, @CurrentUser() user: User) {
    return this.questionsService.bulkCreateQuestions(dto, user);
  }

  @Patch('questions/bulk/status')
  bulkUpdateQuestionStatus(@Body() dto: BulkUpdateQuestionStatusDto, @CurrentUser() user: User) {
    return this.questionsService.bulkUpdateQuestionStatus(dto, user);
  }

  @Get('questions')
  listQuestions(@Query() dto: ListQuestionsDto) {
    return this.questionsService.listQuestions(dto);
  }

  @Get('questions/:id')
  getQuestion(@Param('id') id: string) {
    return this.questionsService.getQuestion(id);
  }

  @Patch('questions/:id')
  updateQuestion(@Param('id') id: string, @Body() dto: UpdateQuestionDto) {
    return this.questionsService.updateQuestion(id, dto);
  }

  @Delete('questions/:id')
  deleteQuestion(@Param('id') id: string) {
    return this.questionsService.deleteQuestion(id);
  }

  @Patch('questions/:id/status')
  updateQuestionStatus(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.questionsService.updateQuestionStatus(id, dto, user);
  }

  @Post('passage-bundles')
  createPassageBundle(@Body() dto: CreatePassageBundleDto, @CurrentUser() user: User) {
    return this.questionsService.createPassageBundle(dto, user);
  }

  @Post('passage-bundles/with-questions')
  createPassageBundleWithQuestions(
    @Body() dto: CreatePassageBundleWithQuestionsDto,
    @CurrentUser() user: User,
  ) {
    return this.questionsService.createPassageBundleWithQuestions(dto, user);
  }

  @Get('passage-bundles')
  listPassageBundles(@Query() dto: ListPassageBundlesDto) {
    return this.questionsService.listPassageBundles(dto);
  }

  @Get('passage-bundles/:id')
  getPassageBundle(@Param('id') id: string) {
    return this.questionsService.getPassageBundle(id);
  }

  @Patch('passage-bundles/:id')
  updatePassageBundle(@Param('id') id: string, @Body() dto: UpdatePassageBundleDto) {
    return this.questionsService.updatePassageBundle(id, dto);
  }
}
