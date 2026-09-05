import { NotFoundException } from '@nestjs/common';
import { ExamAccessType, ExamSectionType } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ExamsService } from './exams.service';

describe('ExamsService user exam access', () => {
  const findMany = jest.fn();
  const findFirst = jest.fn();
  const findUnique = jest.fn();
  const create = jest.fn();
  const prisma = {
    exam: {
      findMany,
      findFirst,
      findUnique,
      create,
    },
  } as unknown as PrismaService;
  const service = new ExamsService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists only published public or explicitly unlocked exams and maps section counts', async () => {
    findMany.mockResolvedValue([
      examFixture({
        accessType: ExamAccessType.LOCKED,
        accesses: [{
          grantedAt: new Date('2026-07-10T00:00:00.000Z'),
          accessCodeId: 'code-1',
        }],
      }),
    ]);

    const result = await service.listAvailableExams('user-1');

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        isPublished: true,
        OR: [
          { accessType: ExamAccessType.PUBLIC },
          { accesses: { some: { userId: 'user-1' } } },
        ],
      },
    }));
    expect(result).toEqual([
      expect.objectContaining({
        id: 'exam-1',
        access: {
          source: 'ACCESS_CODE',
          grantedAt: new Date('2026-07-10T00:00:00.000Z'),
        },
        counts: {
          mathQuestions: 50,
          readingBundles: 2,
          readingQuestions: 20,
          scienceBundles: 3,
          scienceQuestions: 15,
          totalQuestions: 85,
        },
      }),
    ]);
    expect(result[0]).not.toHaveProperty('instructions');
  });

  it('returns instructions for an available exam detail without question content', async () => {
    findFirst.mockResolvedValue(examFixture({
      accessType: ExamAccessType.PUBLIC,
      accesses: [],
    }));

    const result = await service.getAvailableExam('exam-1', 'user-1');

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'exam-1',
        isPublished: true,
        OR: [
          { accessType: ExamAccessType.PUBLIC },
          { accesses: { some: { userId: 'user-1' } } },
        ],
      },
    }));
    expect(result).toEqual(expect.objectContaining({
      instructions: 'Đọc kỹ hướng dẫn trước khi làm bài.',
      access: {
        source: 'PUBLIC',
        grantedAt: null,
      },
    }));
    expect(result).not.toHaveProperty('mathQuestions');
    expect(result).not.toHaveProperty('passageBundles');
  });

  it('hides unpublished or inaccessible exams behind a not-found response', async () => {
    findFirst.mockResolvedValue(null);

    await expect(service.getAvailableExam('hidden-exam', 'user-1'))
      .rejects
      .toThrow(new NotFoundException('Exam not found or not available'));
  });

  it('creates a single-section exam with the fixed section duration', async () => {
    create.mockImplementation(({ data }) => data);

    const result = await service.createExam({
      title: 'Reading practice',
      sectionTypes: [ExamSectionType.READING],
      blueprintJson: {
        version: 1,
        durationMins: 150,
        sections: [
          { sectionType: 'MATH', targetQuestionCount: 50 },
          { sectionType: 'READING', targetBundleCount: 2, targetQuestionCount: 20 },
          { sectionType: 'SCIENCE', targetBundleCount: 3, targetQuestionCount: 15 },
        ],
      },
    });

    expect(result).toEqual(expect.objectContaining({
      durationMins: 30,
      contentFontSize: 18,
      blueprintJson: expect.objectContaining({
        durationMins: 30,
        sections: [expect.objectContaining({ sectionType: 'READING' })],
      }),
    }));
  });

  it('aggregates attempts and scores per user for admin statistics', async () => {
    findUnique.mockResolvedValue({
      id: 'exam-1',
      title: 'TSA Mock Test 01',
      attempts: [
        {
          id: 'attempt-2',
          status: 'GRADED',
          startedAt: new Date('2026-09-05T02:00:00.000Z'),
          completedAt: new Date('2026-09-05T03:00:00.000Z'),
          user: { id: 'user-1', displayName: 'An', email: 'an@example.com' },
          result: {
            totalScore: 8,
            maxScore: 10,
            percentScore: 80,
            correctCount: 8,
            wrongCount: 2,
            skippedCount: 0,
            durationSecs: 3600,
            completedAt: new Date('2026-09-05T03:00:00.000Z'),
          },
        },
        {
          id: 'attempt-1',
          status: 'GRADED',
          startedAt: new Date('2026-09-04T02:00:00.000Z'),
          completedAt: new Date('2026-09-04T03:00:00.000Z'),
          user: { id: 'user-1', displayName: 'An', email: 'an@example.com' },
          result: {
            totalScore: 6,
            maxScore: 10,
            percentScore: 60,
            correctCount: 6,
            wrongCount: 4,
            skippedCount: 0,
            durationSecs: 3600,
            completedAt: new Date('2026-09-04T03:00:00.000Z'),
          },
        },
      ],
    });

    const result = await service.getExamStatistics('exam-1');

    expect(result.summary).toEqual({
      userCount: 1,
      attemptCount: 2,
      completedAttemptCount: 2,
      averagePercentScore: 70,
    });
    expect(result.users[0]).toEqual(expect.objectContaining({
      attemptCount: 2,
      completedAttemptCount: 2,
      bestPercentScore: 80,
      averagePercentScore: 70,
    }));
  });
});

function examFixture(overrides: {
  accessType: ExamAccessType;
  accesses: Array<{
    grantedAt: Date;
    accessCodeId: string | null;
  }>;
}) {
  return {
    id: 'exam-1',
    title: 'TSA Mock Test 01',
    description: 'Đề mô phỏng đầy đủ cấu trúc TSA.',
    instructions: 'Đọc kỹ hướng dẫn trước khi làm bài.',
    durationMins: 150,
    contentFontSize: 18,
    totalPoints: 100,
    accessType: overrides.accessType,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-12T00:00:00.000Z'),
    _count: {
      mathQuestions: 50,
    },
    passageBundles: [
      ...Array.from({ length: 2 }, () => ({
        sectionType: ExamSectionType.READING,
        passageBundle: {
          questions: Array.from({ length: 10 }, (_, index) => ({
            questionId: `reading-${index}`,
          })),
        },
      })),
      ...Array.from({ length: 3 }, () => ({
        sectionType: ExamSectionType.SCIENCE,
        passageBundle: {
          questions: Array.from({ length: 5 }, (_, index) => ({
            questionId: `science-${index}`,
          })),
        },
      })),
    ],
    accesses: overrides.accesses,
    attempts: [],
  };
}
