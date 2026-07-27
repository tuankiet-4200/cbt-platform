import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ExamSectionType,
  Prisma,
  SessionStatus,
} from '@prisma/client';
import { Job, Queue, Worker } from 'bullmq';
import { PrismaService } from '@/common/prisma/prisma.service';
import { RedisService } from '@/common/redis/redis.service';
import { SyncAnswersDto } from './dto/session.dto';

const SECTION_ORDER = [
  ExamSectionType.MATH,
  ExamSectionType.READING,
  ExamSectionType.SCIENCE,
] as const;

const DEFAULT_SECTION_DURATION: Record<ExamSectionType, number> = {
  MATH: 60,
  READING: 30,
  SCIENCE: 60,
};

const SESSION_QUEUE = 'session-persistence';

type SectionSummary = {
  sectionType: ExamSectionType;
  durationMins: number;
  questionCount: number;
};

type PersistenceJob = {
  sessionId: string;
};

@Injectable()
export class SessionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionsService.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );
    const parsedRedisUrl = new URL(redisUrl);
    const connection = {
      host: parsedRedisUrl.hostname,
      port: Number(parsedRedisUrl.port || 6379),
      username: parsedRedisUrl.username || undefined,
      password: parsedRedisUrl.password || undefined,
      db: Number(parsedRedisUrl.pathname.slice(1) || 0),
      maxRetriesPerRequest: null,
    };
    this.queue = new Queue(SESSION_QUEUE, {
      connection,
    });
    this.worker = new Worker(
      SESSION_QUEUE,
      async (job: Job<PersistenceJob>) => this.processPersistenceJob(job),
      {
        connection,
        concurrency: 10,
      },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Session job ${job?.id ?? 'unknown'} failed: ${error.message}`,
      );
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async createOrResumeAttempt(userId: string, examId: string) {
    const exam = await this.getAuthorizedExam(examId, userId);
    const sections = await this.getSectionSummaries(exam);
    const firstSection = sections[0]?.sectionType;

    if (!firstSection) {
      throw new BadRequestException('Exam has no questions');
    }

    const activeKey = `${userId}:${examId}`;
    const existing = await this.prisma.examAttempt.findUnique({
      where: { activeKey },
    });
    if (existing) return this.getAttempt(existing.id, userId);

    try {
      const attempt = await this.prisma.examAttempt.create({
        data: {
          userId,
          examId,
          activeKey,
          currentSection: firstSection,
        },
      });
      return this.getAttempt(attempt.id, userId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const concurrent = await this.prisma.examAttempt.findUnique({
          where: { activeKey },
        });
        if (concurrent) return this.getAttempt(concurrent.id, userId);
      }
      throw error;
    }
  }

  async getAttempt(attemptId: string, userId: string) {
    let attempt = await this.loadAttempt(attemptId, userId);
    const activeSession = attempt.sessions.find(
      (session) => session.status === SessionStatus.IN_PROGRESS,
    );

    if (activeSession && activeSession.endTime.getTime() <= Date.now()) {
      await this.submitSection(activeSession.id);
      attempt = await this.loadAttempt(attemptId, userId);
    }

    const sections = await this.getSectionSummaries(attempt.exam);

    return {
      id: attempt.id,
      exam: {
        id: attempt.exam.id,
        title: attempt.exam.title,
        instructions: attempt.exam.instructions,
      },
      status: attempt.status,
      currentSection: attempt.currentSection,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      sections: sections.map((section) => {
        const session = attempt.sessions.find(
          (item) => item.sectionType === section.sectionType,
        );
        return {
          ...section,
          session: session
            ? {
                id: session.id,
                status: session.status,
                startTime: session.startTime,
                endTime: session.endTime,
                submittedAt: session.submittedAt,
              }
            : null,
        };
      }),
    };
  }

  async startCurrentSection(attemptId: string, userId: string) {
    const attempt = await this.loadAttempt(attemptId, userId);
    if (attempt.status !== SessionStatus.IN_PROGRESS) {
      throw new ConflictException('Exam attempt is already completed');
    }
    if (!attempt.currentSection) {
      throw new ConflictException('Exam attempt has no pending section');
    }

    const existing = attempt.sessions.find(
      (session) => session.sectionType === attempt.currentSection,
    );
    if (existing) {
      if (existing.status !== SessionStatus.IN_PROGRESS) {
        throw new ConflictException('Section has already been submitted');
      }
      return this.toStartedSession(existing, attempt);
    }

    const sections = await this.getSectionSummaries(attempt.exam);
    const section = sections.find(
      (item) => item.sectionType === attempt.currentSection,
    );
    if (!section) {
      throw new BadRequestException('Current section has no questions');
    }

    const startTime = new Date();
    const endTime = new Date(
      startTime.getTime() + section.durationMins * 60_000,
    );

    try {
      const session = await this.prisma.examSession.create({
        data: {
          attemptId: attempt.id,
          userId: attempt.userId,
          examId: attempt.examId,
          sectionType: section.sectionType,
          durationMins: section.durationMins,
          startTime,
          endTime,
        },
      });
      await this.scheduleTimeout(session.id, endTime);
      return this.toStartedSession(session, attempt);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const concurrent = await this.prisma.examSession.findUnique({
          where: {
            attemptId_sectionType: {
              attemptId,
              sectionType: attempt.currentSection,
            },
          },
        });
        if (concurrent) return this.toStartedSession(concurrent, attempt);
      }
      throw error;
    }
  }

  async getSessionPayload(sessionId: string, userId: string) {
    const session = await this.getOwnedSession(sessionId, userId);
    if (
      session.status === SessionStatus.IN_PROGRESS &&
      session.endTime.getTime() <= Date.now()
    ) {
      await this.submitSection(sessionId);
      throw new ConflictException('Section time has expired');
    }

    const sectionPayload =
      session.sectionType === ExamSectionType.MATH
        ? await this.getMathPayload(session.examId)
        : await this.getBundlePayload(session.examId, session.sectionType);

    return {
      id: session.id,
      attemptId: session.attemptId,
      status: session.status,
      sectionType: session.sectionType,
      durationMins: session.durationMins,
      startTime: session.startTime,
      endTime: session.endTime,
      exam: session.exam,
      candidate: {
        id: session.attempt.user.id,
        displayName: session.attempt.user.displayName,
      },
      ...sectionPayload,
    };
  }

  async getSessionState(sessionId: string, userId: string) {
    const session = await this.getOwnedSession(sessionId, userId);
    const answerKey = this.answerKey(sessionId);
    const timingKey = this.timingKey(sessionId);
    let answers = await this.redis.hgetall(answerKey);
    let timing = await this.redis.hgetall(timingKey);

    if (Object.keys(answers).length === 0) {
      const persisted = await this.prisma.sessionAnswer.findMany({
        where: { sessionId },
        select: {
          questionId: true,
          answerJson: true,
          timeSpentMs: true,
        },
      });
      if (persisted.length > 0) {
        const pipeline = this.redis.client.pipeline();
        for (const answer of persisted) {
          if (answer.answerJson !== null) {
            const serialized = JSON.stringify(answer.answerJson);
            answers[answer.questionId] = serialized;
            pipeline.hset(answerKey, answer.questionId, serialized);
          }
          if (answer.timeSpentMs !== null) {
            const serializedTiming = String(answer.timeSpentMs);
            timing[answer.questionId] = serializedTiming;
            pipeline.hset(timingKey, answer.questionId, serializedTiming);
          }
        }
        pipeline.expire(answerKey, RedisService.TTL.SESSION);
        pipeline.expire(timingKey, RedisService.TTL.SESSION);
        await pipeline.exec();
      }
    }

    const meta = await this.redis.hgetall(this.metaKey(sessionId));
    return {
      sessionId,
      status: session.status,
      endTime: session.endTime,
      answers: Object.fromEntries(
        Object.entries(answers).map(([questionId, value]) => [
          questionId,
          this.parseJson(value),
        ]),
      ),
      timing: Object.fromEntries(
        Object.entries(timing).map(([questionId, value]) => [
          questionId,
          Number(value),
        ]),
      ),
      currentIndex: Number(meta.currentIndex ?? 0),
      source: Object.keys(answers).length > 0 ? 'REDIS_OR_RECOVERED' : 'EMPTY',
    };
  }

  async syncAnswers(
    sessionId: string,
    userId: string,
    idempotencyKey: string | undefined,
    dto: SyncAnswersDto,
  ) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('X-Idempotency-Key header is required');
    }
    const session = await this.getOwnedSession(sessionId, userId);
    if (session.status !== SessionStatus.IN_PROGRESS) {
      throw new ConflictException('Section is not in progress');
    }
    if (session.endTime.getTime() <= Date.now()) {
      await this.submitSection(sessionId);
      throw new ConflictException('Section time has expired');
    }

    const dedupeKey = `idempotency:${sessionId}:sync:${idempotencyKey}`;
    const acquired = await this.redis.client.set(
      dedupeKey,
      '1',
      'EX',
      RedisService.TTL.SESSION,
      'NX',
    );
    if (acquired === null) {
      return { ok: true, duplicate: true };
    }

    const allowedQuestionIds = await this.getSectionQuestionIds(
      session.examId,
      session.sectionType,
    );
    const invalidQuestion = dto.answers.find(
      (answer) => !allowedQuestionIds.has(answer.questionId),
    );
    if (invalidQuestion) {
      await this.redis.del(dedupeKey);
      throw new ForbiddenException(
        `Question ${invalidQuestion.questionId} does not belong to this section`,
      );
    }

    const answerKey = this.answerKey(sessionId);
    const timingKey = this.timingKey(sessionId);
    const metaKey = this.metaKey(sessionId);
    const pipeline = this.redis.client.pipeline();
    for (const answer of dto.answers) {
      pipeline.hset(
        answerKey,
        answer.questionId,
        JSON.stringify(answer.answerJson),
      );
      pipeline.hset(
        timingKey,
        answer.questionId,
        String(answer.timeSpentMs),
      );
    }
    pipeline.hset(metaKey, 'currentIndex', String(dto.currentIndex));
    pipeline.hset(metaKey, 'updatedAt', new Date().toISOString());
    pipeline.expire(answerKey, RedisService.TTL.SESSION);
    pipeline.expire(timingKey, RedisService.TTL.SESSION);
    pipeline.expire(metaKey, RedisService.TTL.SESSION);
    try {
      await pipeline.exec();
      await this.scheduleFlush(sessionId);
    } catch (error) {
      await this.redis.del(dedupeKey);
      throw error;
    }

    return { ok: true, duplicate: false, syncedAt: new Date() };
  }

  async submitSection(sessionId: string, userId?: string) {
    const session = userId
      ? await this.getOwnedSession(sessionId, userId)
      : await this.prisma.examSession.findUnique({
          where: { id: sessionId },
          include: { attempt: true, exam: true },
        });
    if (!session) throw new NotFoundException('Session not found');

    if (session.status !== SessionStatus.IN_PROGRESS) {
      return this.getTransition(session.attemptId);
    }

    await this.flushSessionAnswers(sessionId);
    const sections = await this.getSectionSummaries(session.exam);
    const currentIndex = sections.findIndex(
      (item) => item.sectionType === session.sectionType,
    );
    const nextSection = sections[currentIndex + 1]?.sectionType ?? null;
    const submittedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.examSession.updateMany({
        where: { id: sessionId, status: SessionStatus.IN_PROGRESS },
        data: {
          status: SessionStatus.SUBMITTED,
          submittedAt,
        },
      });
      if (updated.count === 0) return;

      await tx.examAttempt.update({
        where: { id: session.attemptId },
        data: nextSection
          ? { currentSection: nextSection }
          : {
              currentSection: null,
              status: SessionStatus.SUBMITTED,
              completedAt: submittedAt,
              activeKey: null,
            },
      });
    });

    return this.getTransition(session.attemptId);
  }

  private async processPersistenceJob(job: Job<PersistenceJob>) {
    if (job.name === 'flush') {
      await this.flushSessionAnswers(job.data.sessionId);
      return;
    }
    if (job.name === 'timeout') {
      const session = await this.prisma.examSession.findUnique({
        where: { id: job.data.sessionId },
        select: { status: true, endTime: true },
      });
      if (
        session?.status === SessionStatus.IN_PROGRESS &&
        session.endTime.getTime() <= Date.now()
      ) {
        await this.submitSection(job.data.sessionId);
      }
    }
  }

  private async flushSessionAnswers(sessionId: string) {
    const answers = await this.redis.hgetall(this.answerKey(sessionId));
    if (Object.keys(answers).length === 0) return;
    const timing = await this.redis.hgetall(this.timingKey(sessionId));

    await this.prisma.$transaction(
      Object.entries(answers).map(([questionId, serialized]) =>
        this.prisma.sessionAnswer.upsert({
          where: { sessionId_questionId: { sessionId, questionId } },
          update: {
            answerJson: this.toInputJson(serialized),
            timeSpentMs: Number(timing[questionId] ?? 0),
            answeredAt: new Date(),
          },
          create: {
            sessionId,
            questionId,
            answerJson: this.toInputJson(serialized),
            timeSpentMs: Number(timing[questionId] ?? 0),
          },
        }),
      ),
    );
  }

  private async scheduleFlush(sessionId: string) {
    await this.queue?.add(
      'flush',
      { sessionId },
      {
        jobId: `flush-${sessionId}`,
        delay: 30_000,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }

  private async scheduleTimeout(sessionId: string, endTime: Date) {
    await this.queue?.add(
      'timeout',
      { sessionId },
      {
        jobId: `timeout-${sessionId}`,
        delay: Math.max(0, endTime.getTime() - Date.now()),
        attempts: 5,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }

  private async getTransition(attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        sessions: {
          orderBy: { startTime: 'asc' },
          select: {
            id: true,
            sectionType: true,
            status: true,
            submittedAt: true,
            answers: { select: { questionId: true } },
          },
        },
      },
    });
    if (!attempt) throw new NotFoundException('Exam attempt not found');
    const latest = attempt.sessions.at(-1);
    return {
      attemptId,
      completed: attempt.status !== SessionStatus.IN_PROGRESS,
      nextSection: attempt.currentSection,
      submittedSection: latest?.sectionType ?? null,
      answeredCount: latest?.answers.length ?? 0,
    };
  }

  private async loadAttempt(attemptId: string, userId: string) {
    const attempt = await this.prisma.examAttempt.findFirst({
      where: { id: attemptId, userId },
      include: {
        exam: true,
        sessions: { orderBy: { startTime: 'asc' } },
      },
    });
    if (!attempt) throw new NotFoundException('Exam attempt not found');
    return attempt;
  }

  private async getOwnedSession(sessionId: string, userId: string) {
    const session = await this.prisma.examSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        exam: { select: { id: true, title: true, blueprintJson: true } },
        attempt: {
          include: {
            user: { select: { id: true, displayName: true } },
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  private async getAuthorizedExam(examId: string, userId: string) {
    const exam = await this.prisma.exam.findFirst({
      where: {
        id: examId,
        isPublished: true,
        OR: [
          { accessType: 'PUBLIC' },
          { accesses: { some: { userId } } },
        ],
      },
    });
    if (!exam) {
      throw new NotFoundException('Exam not found or not available');
    }
    return exam;
  }

  private async getSectionSummaries(exam: {
    id: string;
    blueprintJson: Prisma.JsonValue | null;
  }): Promise<SectionSummary[]> {
    const [mathCount, bundleRows] = await Promise.all([
      this.prisma.examMathQuestion.count({ where: { examId: exam.id } }),
      this.prisma.examPassageBundle.findMany({
        where: { examId: exam.id },
        select: {
          sectionType: true,
          passageBundle: {
            select: { _count: { select: { questions: true } } },
          },
        },
      }),
    ]);
    const counts: Record<ExamSectionType, number> = {
      MATH: mathCount,
      READING: 0,
      SCIENCE: 0,
    };
    for (const row of bundleRows) {
      counts[row.sectionType] += row.passageBundle._count.questions;
    }

    return SECTION_ORDER.filter((sectionType) => counts[sectionType] > 0).map(
      (sectionType) => ({
        sectionType,
        durationMins: this.getSectionDuration(
          exam.blueprintJson,
          sectionType,
        ),
        questionCount: counts[sectionType],
      }),
    );
  }

  private getSectionDuration(
    blueprintJson: Prisma.JsonValue | null,
    sectionType: ExamSectionType,
  ) {
    if (this.isJsonObject(blueprintJson)) {
      const sections = blueprintJson.sections;
      if (Array.isArray(sections)) {
        const section = sections.find(
          (item) =>
            this.isJsonObject(item) &&
            item.sectionType === sectionType,
        );
        if (
          this.isJsonObject(section) &&
          typeof section.durationMins === 'number' &&
          section.durationMins > 0
        ) {
          return Math.floor(section.durationMins);
        }
      }
    }
    return DEFAULT_SECTION_DURATION[sectionType];
  }

  private async getMathPayload(examId: string) {
    const rows = await this.prisma.examMathQuestion.findMany({
      where: { examId },
      orderBy: { orderInSection: 'asc' },
      include: {
        question: {
          select: {
            id: true,
            type: true,
            contentJson: true,
            expectedTimeSecs: true,
          },
        },
      },
    });
    return {
      layout: 'SINGLE_COLUMN',
      questions: rows.map((row) => ({
        id: row.question.id,
        type: row.question.type,
        content: this.sanitizeQuestionContent(row.question.contentJson),
        expectedTimeSecs: row.question.expectedTimeSecs,
        points: row.points,
        orderInSection: row.orderInSection,
      })),
      bundles: [],
      totalQuestions: rows.length,
    };
  }

  private async getBundlePayload(
    examId: string,
    sectionType: ExamSectionType,
  ) {
    const rows = await this.prisma.examPassageBundle.findMany({
      where: { examId, sectionType },
      orderBy: { orderInSection: 'asc' },
      include: {
        passageBundle: {
          select: {
            id: true,
            title: true,
            contentJson: true,
            questions: {
              orderBy: { orderInBundle: 'asc' },
              include: {
                question: {
                  select: {
                    id: true,
                    type: true,
                    contentJson: true,
                    expectedTimeSecs: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    const bundles = rows.map((row) => ({
      id: row.passageBundle.id,
      title: row.passageBundle.title,
      content: row.passageBundle.contentJson,
      orderInSection: row.orderInSection,
      questions: row.passageBundle.questions.map((item) => ({
        id: item.question.id,
        type: item.question.type,
        content: this.sanitizeQuestionContent(item.question.contentJson),
        expectedTimeSecs: item.question.expectedTimeSecs,
        points: item.points,
        orderInBundle: item.orderInBundle,
      })),
    }));
    return {
      layout: 'TWO_COLUMN',
      questions: [],
      bundles,
      totalQuestions: bundles.reduce(
        (total, bundle) => total + bundle.questions.length,
        0,
      ),
    };
  }

  private async getSectionQuestionIds(
    examId: string,
    sectionType: ExamSectionType,
  ) {
    if (sectionType === ExamSectionType.MATH) {
      const rows = await this.prisma.examMathQuestion.findMany({
        where: { examId },
        select: { questionId: true },
      });
      return new Set(rows.map((row) => row.questionId));
    }
    const rows = await this.prisma.examPassageBundle.findMany({
      where: { examId, sectionType },
      select: {
        passageBundle: {
          select: { questions: { select: { questionId: true } } },
        },
      },
    });
    return new Set(
      rows.flatMap((row) =>
        row.passageBundle.questions.map((item) => item.questionId),
      ),
    );
  }

  private sanitizeQuestionContent(content: Prisma.JsonValue): unknown {
    const forbidden = new Set([
      'isCorrect',
      'isTrue',
      'correctItemId',
      'correctValue',
      'solution',
    ]);
    const sanitize = (value: Prisma.JsonValue | undefined): unknown => {
      if (value === undefined) return null;
      if (Array.isArray(value)) return value.map((item) => sanitize(item));
      if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value)
            .filter(([key]) => !forbidden.has(key))
            .map(([key, item]) => [key, sanitize(item)]),
        );
      }
      return value;
    };
    return sanitize(content);
  }

  private isJsonObject(
    value: Prisma.JsonValue | undefined,
  ): value is Prisma.JsonObject {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  private toStartedSession(
    session: {
      id: string;
      sectionType: ExamSectionType;
      status: SessionStatus;
      startTime: Date;
      endTime: Date;
      durationMins: number;
    },
    attempt: { id: string },
  ) {
    return {
      attemptId: attempt.id,
      sessionId: session.id,
      sectionType: session.sectionType,
      status: session.status,
      durationMins: session.durationMins,
      startTime: session.startTime,
      endTime: session.endTime,
    };
  }

  private parseJson(value: string): unknown {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }

  private toInputJson(value: string): Prisma.InputJsonValue {
    return JSON.parse(value) as Prisma.InputJsonValue;
  }

  private answerKey(sessionId: string) {
    return `session:${sessionId}:answers`;
  }

  private timingKey(sessionId: string) {
    return `session:${sessionId}:timing`;
  }

  private metaKey(sessionId: string) {
    return `session:${sessionId}:meta`;
  }
}
