import {
  Injectable,
  Logger,
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
import { gradeQuestion } from './grading.util';

const SECTION_ORDER = [
  ExamSectionType.MATH,
  ExamSectionType.READING,
  ExamSectionType.SCIENCE,
] as const;

type GradeJob = { attemptId: string };

type GradableItem = {
  section: ExamSectionType;
  questionId: string;
  points: number;
  type: Parameters<typeof gradeQuestion>[0];
  contentJson: Prisma.JsonValue;
  tags: Array<{ tag: { id: string; name: string } }>;
};

@Injectable()
export class GradingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GradingService.name);
  private worker?: Worker;
  private deadLetterQueue?: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const connection = this.redisConnection();
    this.deadLetterQueue = new Queue('grading-dead-letter', { connection });
    this.worker = new Worker(
      'grading-queue',
      async (job: Job<GradeJob>) => {
        if (job.name !== 'grade-attempt') return;
        await this.gradeAttempt(job.data.attemptId);
      },
      { connection, concurrency: 5 },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Grading job ${job?.id ?? 'unknown'} failed: ${error.message}`,
      );
      const maxAttempts = job?.opts.attempts ?? 1;
      if (job && job.attemptsMade >= maxAttempts) {
        void this.deadLetterQueue?.add(
          'grade-attempt-failed',
          {
            ...job.data,
            sourceJobId: job.id,
            error: error.message,
          },
          { removeOnComplete: 1_000 },
        );
      }
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.deadLetterQueue?.close();
  }

  async gradeAttempt(attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: true,
        result: true,
        sessions: {
          include: {
            answers: true,
          },
        },
      },
    });
    if (!attempt) throw new Error(`Exam attempt ${attemptId} not found`);
    if (attempt.status === SessionStatus.IN_PROGRESS) {
      throw new Error(`Exam attempt ${attemptId} is still in progress`);
    }
    if (attempt.status === SessionStatus.GRADED && attempt.result) {
      return attempt.result;
    }

    const availableItems = await this.loadGradableItems(attempt.examId);
    const availableSections = SECTION_ORDER.filter((section) =>
      availableItems.some((item) => item.section === section),
    );
    const selectedSections = attempt.selectedSections.length > 0
      ? SECTION_ORDER.filter((section) =>
          attempt.selectedSections.includes(section),
        )
      : availableSections;
    const selectedSet = new Set(selectedSections);
    const items = availableItems.filter((item) => selectedSet.has(item.section));
    const sessionsBySection = new Map(
      attempt.sessions.map((session) => [session.sectionType, session]),
    );
    const sectionScores = selectedSections.map((section) => ({
      section,
      score: 0,
      maxScore: 0,
      correct: 0,
      total: 0,
    }));
    const tagStats = new Map<
      string,
      { tagId: string; tagName: string; correct: number; total: number }
    >();
    const answerUpdates: Array<{
      id: string;
      isCorrect: boolean;
      pointsEarned: number;
    }> = [];
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;

    for (const item of items) {
      const sectionScore = sectionScores.find(
        (score) => score.section === item.section,
      );
      if (!sectionScore) continue;
      sectionScore.total += 1;
      sectionScore.maxScore += item.points;

      const session = sessionsBySection.get(item.section);
      const answer = session?.answers.find(
        (candidate) => candidate.questionId === item.questionId,
      );
      const isCorrect = answer
        ? gradeQuestion(item.type, item.contentJson, answer.answerJson)
        : false;

      if (!answer) {
        skippedCount += 1;
      } else if (isCorrect) {
        correctCount += 1;
      } else {
        wrongCount += 1;
      }

      if (isCorrect) {
        sectionScore.correct += 1;
        sectionScore.score += item.points;
      }
      if (answer) {
        answerUpdates.push({
          id: answer.id,
          isCorrect,
          pointsEarned: isCorrect ? item.points : 0,
        });
      }

      for (const questionTag of item.tags) {
        const current = tagStats.get(questionTag.tag.id) ?? {
          tagId: questionTag.tag.id,
          tagName: questionTag.tag.name,
          correct: 0,
          total: 0,
        };
        current.total += 1;
        if (isCorrect) current.correct += 1;
        tagStats.set(questionTag.tag.id, current);
      }
    }

    const totalScore = sectionScores.reduce(
      (sum, section) => sum + section.score,
      0,
    );
    const maxScore = sectionScores.reduce(
      (sum, section) => sum + section.maxScore,
      0,
    );
    const percentScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    const durationSecs = attempt.sessions.reduce((sum, session) => {
      const stoppedAt = session.submittedAt ?? session.endTime;
      return (
        sum +
        Math.max(
          0,
          Math.floor(
            (stoppedAt.getTime() - session.startTime.getTime()) / 1_000,
          ),
        )
      );
    }, 0);

    const result = await this.prisma.$transaction(async (tx) => {
      for (const answer of answerUpdates) {
        await tx.sessionAnswer.update({
          where: { id: answer.id },
          data: {
            isCorrect: answer.isCorrect,
            pointsEarned: answer.pointsEarned,
          },
        });
      }
      const saved = await tx.examResult.upsert({
        where: { attemptId },
        update: {
          totalScore,
          maxScore,
          percentScore,
          correctCount,
          wrongCount,
          skippedCount,
          durationSecs,
          sectionScores,
          tagBreakdown: [...tagStats.values()],
          completedAt: new Date(),
        },
        create: {
          attemptId,
          totalScore,
          maxScore,
          percentScore,
          correctCount,
          wrongCount,
          skippedCount,
          durationSecs,
          sectionScores,
          tagBreakdown: [...tagStats.values()],
        },
      });
      await tx.examSession.updateMany({
        where: { attemptId },
        data: { status: SessionStatus.GRADED },
      });
      await tx.examAttempt.update({
        where: { id: attemptId },
        data: { status: SessionStatus.GRADED },
      });
      return saved;
    });

    const isFullExamAttempt =
      selectedSections.length === availableSections.length &&
      availableSections.every((section) => selectedSet.has(section));
    if (isFullExamAttempt) {
      await this.redis.zadd(
        `leaderboard:${attempt.examId}`,
        percentScore,
        attempt.userId,
        true,
      );
    }
    return result;
  }

  private async loadGradableItems(examId: string): Promise<GradableItem[]> {
    const [math, bundles] = await Promise.all([
      this.prisma.examMathQuestion.findMany({
        where: { examId },
        include: {
          question: {
            select: {
              id: true,
              type: true,
              contentJson: true,
              tags: {
                select: { tag: { select: { id: true, name: true } } },
              },
            },
          },
        },
      }),
      this.prisma.examPassageBundle.findMany({
        where: { examId },
        include: {
          passageBundle: {
            select: {
              questions: {
                include: {
                  question: {
                    select: {
                      id: true,
                      type: true,
                      contentJson: true,
                      tags: {
                        select: {
                          tag: { select: { id: true, name: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    return [
      ...math.map((item) => ({
        section: ExamSectionType.MATH,
        questionId: item.question.id,
        points: item.points,
        type: item.question.type,
        contentJson: item.question.contentJson,
        tags: item.question.tags,
      })),
      ...bundles.flatMap((bundle) =>
        bundle.passageBundle.questions.map((item) => ({
          section: bundle.sectionType,
          questionId: item.question.id,
          points: item.points,
          type: item.question.type,
          contentJson: item.question.contentJson,
          tags: item.question.tags,
        })),
      ),
    ];
  }

  private redisConnection() {
    const redisUrl = this.config.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );
    const parsed = new URL(redisUrl);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      db: Number(parsed.pathname.slice(1) || 0),
      maxRetriesPerRequest: null,
    };
  }
}
