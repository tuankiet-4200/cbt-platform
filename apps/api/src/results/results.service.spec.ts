import { ConflictException, NotFoundException } from '@nestjs/common';
import { ExamSectionType, SessionStatus } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { GradingService } from './grading.service';
import { ResultsService } from './results.service';

describe('ResultsService authorization and pagination', () => {
  const attemptFindFirst = jest.fn();
  const mathCount = jest.fn();
  const mathFindMany = jest.fn();
  const answerFindMany = jest.fn();
  const prisma = {
    examAttempt: { findFirst: attemptFindFirst },
    examMathQuestion: {
      count: mathCount,
      findMany: mathFindMany,
    },
    sessionAnswer: { findMany: answerFindMany },
  } as unknown as PrismaService;
  const grading = { gradeAttempt: jest.fn() } as unknown as GradingService;
  const service = new ResultsService(prisma, grading);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hides another user result behind not found', async () => {
    attemptFindFirst.mockResolvedValue(null);

    await expect(service.getResult('attempt-1', 'user-2')).rejects.toThrow(
      new NotFoundException('Exam attempt not found'),
    );
    expect(attemptFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'attempt-1', userId: 'user-2' },
      }),
    );
  });

  it('does not expose answer review while an attempt is in progress', async () => {
    attemptFindFirst.mockResolvedValue({
      id: 'attempt-1',
      status: SessionStatus.IN_PROGRESS,
      exam: { id: 'exam-1', title: 'Exam', totalPoints: 10 },
      result: null,
    });

    await expect(
      service.getAnswerReview('attempt-1', 'user-1', {
        section: ExamSectionType.MATH,
        page: 1,
        limit: 100,
      }),
    ).rejects.toThrow(
      new ConflictException('Exam attempt is still in progress'),
    );
    expect(mathFindMany).not.toHaveBeenCalled();
  });
});
