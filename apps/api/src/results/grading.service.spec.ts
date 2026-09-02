import { ConfigService } from '@nestjs/config';
import {
  ExamSectionType,
  QuestionType,
  SessionStatus,
} from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { RedisService } from '@/common/redis/redis.service';
import { GradingService } from './grading.service';

describe('GradingService section-scoped attempts', () => {
  const examAttemptFindUnique = jest.fn();
  const examAttemptUpdate = jest.fn();
  const mathFindMany = jest.fn();
  const bundleFindMany = jest.fn();
  const answerUpdate = jest.fn();
  const sessionUpdateMany = jest.fn();
  const resultUpsert = jest.fn();
  const transaction = jest.fn();
  const zadd = jest.fn();
  const prismaMock = {
    examAttempt: {
      findUnique: examAttemptFindUnique,
      update: examAttemptUpdate,
    },
    examMathQuestion: { findMany: mathFindMany },
    examPassageBundle: { findMany: bundleFindMany },
    sessionAnswer: { update: answerUpdate },
    examSession: { updateMany: sessionUpdateMany },
    examResult: { upsert: resultUpsert },
    $transaction: transaction,
  };
  const prisma = prismaMock as unknown as PrismaService;
  const redis = { zadd } as unknown as RedisService;
  const config = { get: jest.fn() } as unknown as ConfigService;
  const service = new GradingService(prisma, redis, config);

  beforeEach(() => {
    jest.clearAllMocks();
    transaction.mockImplementation(
      (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock),
    );
    sessionUpdateMany.mockResolvedValue({ count: 1 });
    examAttemptUpdate.mockResolvedValue({});
  });

  it('grades only selected sections and excludes partial retakes from the full leaderboard', async () => {
    examAttemptFindUnique.mockResolvedValue({
      id: 'attempt-1',
      examId: 'exam-1',
      userId: 'user-1',
      status: SessionStatus.SUBMITTED,
      selectedSections: [ExamSectionType.READING],
      result: null,
      exam: { id: 'exam-1' },
      sessions: [{
        sectionType: ExamSectionType.READING,
        startTime: new Date('2026-09-03T00:00:00.000Z'),
        endTime: new Date('2026-09-03T00:30:00.000Z'),
        submittedAt: new Date('2026-09-03T00:20:00.000Z'),
        answers: [],
      }],
    });
    mathFindMany.mockResolvedValue([questionRow('math-1')]);
    bundleFindMany.mockResolvedValue([
      bundleRow(ExamSectionType.READING, 'reading-1'),
      bundleRow(ExamSectionType.SCIENCE, 'science-1'),
    ]);
    resultUpsert.mockImplementation(({ create }) => ({ id: 'result-1', ...create }));

    const result = await service.gradeAttempt('attempt-1');

    expect(result.sectionScores).toEqual([{
      section: ExamSectionType.READING,
      score: 0,
      maxScore: 1,
      correct: 0,
      total: 1,
    }]);
    expect(result.skippedCount).toBe(1);
    expect(result.maxScore).toBe(1);
    expect(zadd).not.toHaveBeenCalled();
  });
});

function questionRow(questionId: string) {
  return {
    points: 1,
    question: {
      id: questionId,
      type: QuestionType.SINGLE_CHOICE,
      contentJson: {
        payload: { options: [{ id: 'A', isCorrect: true }] },
      },
      tags: [],
    },
  };
}

function bundleRow(sectionType: ExamSectionType, questionId: string) {
  return {
    sectionType,
    passageBundle: {
      questions: [questionRow(questionId)],
    },
  };
}
