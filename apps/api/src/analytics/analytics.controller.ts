import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';
import { AnalyticsHistoryQueryDto } from './dto/analytics-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('analytics/me')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('exams/:examId')
  getExamHistory(
    @Param('examId') examId: string,
    @Query() query: AnalyticsHistoryQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.analyticsService.getExamHistory(user.id, examId, query);
  }

  @Get('weaknesses')
  getWeaknesses(@CurrentUser() user: User) {
    return this.analyticsService.getWeaknesses(user.id);
  }

  @Get('time-analysis')
  getTimeAnalysis(@CurrentUser() user: User) {
    return this.analyticsService.getTimeAnalysis(user.id);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('exams')
export class LeaderboardController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get(':examId/leaderboard')
  getLeaderboard(
    @Param('examId') examId: string,
    @CurrentUser() user: User,
  ) {
    return this.analyticsService.getLeaderboard(examId, user.id);
  }
}
