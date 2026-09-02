import { NotFoundException } from '@nestjs/common';
import { ExamAccessType, ExamSectionType } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ExamsService } from './exams.service';

describe('ExamsService user exam access', () => {
  const findMany = jest.fn();
  const findFirst = jest.fn();
  const create = jest.fn();
  const prisma = {
    exam: {
      findMany,
      findFirst,
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
      blueprintJson: expect.objectContaining({
        durationMins: 30,
        sections: [expect.objectContaining({ sectionType: 'READING' })],
      }),
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
