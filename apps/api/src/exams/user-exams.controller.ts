import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ExamsService } from './exams.service';

@UseGuards(JwtAuthGuard)
@Controller('exams')
export class UserExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Get()
  listAvailableExams(@CurrentUser() user: User) {
    return this.examsService.listAvailableExams(user.id);
  }

  @Get('practice/tags')
  listPracticeTags() {
    return this.examsService.listPracticeTags();
  }

  @Get('practice/tags/:tagId')
  getTagPractice(@Param('tagId') tagId: string) {
    return this.examsService.getTagPractice(tagId);
  }

  @Get(':id/practice')
  getExamPractice(@Param('id') id: string, @CurrentUser() user: User) {
    return this.examsService.getExamPractice(id, user.id);
  }

  @Get(':id')
  getAvailableExam(@Param('id') id: string, @CurrentUser() user: User) {
    return this.examsService.getAvailableExam(id, user.id);
  }
}
