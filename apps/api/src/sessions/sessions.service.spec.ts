import { ConfigService } from '@nestjs/config';
import {
  ExamSectionType,
  QuestionType,
  SessionStatus,
} from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { RedisService } from '@/common/redis/redis.service';
import { SessionsService } from './sessions.service';

describe('SessionsService', () => {
  const examSessionFindFirst = jest.fn();
  const examMathQuestionFindMany = jest.fn();
  const prisma = {
    examSession: {
      findFirst: examSessionFindFirst,
    },
    examMathQuestion: {
      findMany: examMathQuestionFindMany,
    },
  } as unknown as PrismaService;
  const redis = {} as RedisService;
  const config = { get: jest.fn() } as unknown as ConfigService;
  const service = new SessionsService(prisma, redis, config);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a safe active-section payload without grading keys or solutions', async () => {
    examSessionFindFirst.mockResolvedValue({
      id: 'session-1',
      attemptId: 'attempt-1',
      userId: 'user-1',
      examId: 'exam-1',
      sectionType: ExamSectionType.MATH,
      durationMins: 60,
      status: SessionStatus.IN_PROGRESS,
      startTime: new Date('2026-07-27T00:00:00.000Z'),
      endTime: new Date('2099-07-27T01:00:00.000Z'),
      exam: {
        id: 'exam-1',
        title: 'TSA Mock',
        blueprintJson: null,
      },
      attempt: {
        user: {
          id: 'user-1',
          displayName: 'Student',
        },
      },
    });
    examMathQuestionFindMany.mockResolvedValue([
      {
        orderInSection: 0,
        points: 1,
        question: {
          id: 'question-1',
          type: QuestionType.SINGLE_CHOICE,
          expectedTimeSecs: 90,
          contentJson: {
            stem: [{ type: 'text', content: '2 + 2 = ?' }],
            type: 'SINGLE_CHOICE',
            payload: {
              options: [
                {
                  id: 'A',
                  content: [{ type: 'text', content: '4' }],
                  isCorrect: true,
                },
              ],
            },
            solution: [{ type: 'text', content: '4' }],
            _version: 2,
          },
        },
      },
    ]);

    const payload = await service.getSessionPayload('session-1', 'user-1');
    const serialized = JSON.stringify(payload);

    expect(payload).toEqual(
      expect.objectContaining({
        sectionType: ExamSectionType.MATH,
        layout: 'SINGLE_COLUMN',
        totalQuestions: 1,
      }),
    );
    expect(serialized).not.toContain('isCorrect');
    expect(serialized).not.toContain('solution');
  });
});
