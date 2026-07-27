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

  @Get(':id')
  getAvailableExam(@Param('id') id: string, @CurrentUser() user: User) {
    return this.examsService.getAvailableExam(id, user.id);
  }
}
