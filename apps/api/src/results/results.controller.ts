import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ResultsService } from './results.service';
import { ResultReviewQueryDto } from './dto/result-review-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('results')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Get(':attemptId')
  getResult(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: User,
  ) {
    return this.resultsService.getResult(attemptId, user.id);
  }

  @Get(':attemptId/answers')
  getAnswerReview(
    @Param('attemptId') attemptId: string,
    @Query() query: ResultReviewQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.resultsService.getAnswerReview(attemptId, user.id, query);
  }
}
