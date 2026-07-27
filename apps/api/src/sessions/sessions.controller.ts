import {
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  CreateExamAttemptDto,
  RecordProctoringEventsDto,
  SyncAnswersDto,
} from './dto/session.dto';
import { SessionsService } from './sessions.service';

@UseGuards(JwtAuthGuard)
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  createOrResume(
    @Body() dto: CreateExamAttemptDto,
    @CurrentUser() user: User,
  ) {
    return this.sessionsService.createOrResumeAttempt(user.id, dto.examId);
  }

  @Get('attempts/:attemptId')
  getAttempt(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: User,
  ) {
    return this.sessionsService.getAttempt(attemptId, user.id);
  }

  @Post('attempts/:attemptId/start')
  startSection(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: User,
  ) {
    return this.sessionsService.startCurrentSection(attemptId, user.id);
  }

  @Get(':sessionId/state')
  getState(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: User,
  ) {
    return this.sessionsService.getSessionState(sessionId, user.id);
  }

  @Post(':sessionId/sync')
  syncAnswers(
    @Param('sessionId') sessionId: string,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: SyncAnswersDto,
    @CurrentUser() user: User,
  ) {
    return this.sessionsService.syncAnswers(
      sessionId,
      user.id,
      idempotencyKey,
      dto,
    );
  }

  @Patch(':sessionId/submit')
  submitSection(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: User,
  ) {
    return this.sessionsService.submitSection(sessionId, user.id);
  }

  @Post(':sessionId/events')
  recordProctoringEvents(
    @Param('sessionId') sessionId: string,
    @Body() dto: RecordProctoringEventsDto,
    @CurrentUser() user: User,
  ) {
    return this.sessionsService.recordProctoringEvents(
      sessionId,
      user.id,
      dto,
    );
  }

  @Get(':sessionId')
  getSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: User,
  ) {
    return this.sessionsService.getSessionPayload(sessionId, user.id);
  }
}
